import { PROTOCOL_VERSION } from '@entangle/protocol';
import type { PointerMoveMessage } from '@entangle/protocol';
import { makeMutable, runOnJS } from 'react-native-reanimated';

/**
 * The pointer uplink, running on the UI thread.
 *
 * Measurements put the touch stream at ~60 Hz on a 120 Hz phone: gesture
 * callbacks were hopping to the JS thread before anything could accumulate
 * them, and half the samples were lost on the way. Everything here runs in a
 * worklet instead, so a frame reaches the socket without the JS thread being
 * involved at all — `expo-modules-core`'s `installOnUIRuntime` is what makes
 * the native send reachable from here.
 *
 * State lives in shared values because worklets get a copy of module scope,
 * not a reference to it. Scalars are cheap: reading and writing one from the
 * UI thread is a memory access, not a bridge crossing.
 */

/** Minimum gap between frames on the wire. */
const MIN_SEND_INTERVAL_MS = 4;

/**
 * `Date.now` rather than `performance.now`, because this has to give the same
 * answer on the UI thread and the JS thread — frames can leave from either,
 * and the Mac measures delay variation by differencing consecutive stamps.
 * One millisecond of resolution is coarse for that, but two clocks would be
 * wrong.
 */
function now(): number {
  'worklet';
  return Date.now();
}

// Hot state, written only from the UI thread.
const pendingDx = makeMutable(0);
const pendingDy = makeMutable(0);
const cumulativeX = makeMutable(0);
const cumulativeY = makeMutable(0);
const gestureId = makeMutable(0);
const gestureStarting = makeMutable(true);
const sequence = makeMutable(0);
const lastSentAt = makeMutable(0);

// Counters drained once a second by the diagnostics tick.
const touchCount = makeMutable(0);
const sendCount = makeMutable(0);

// Configuration mirrored from the JS side; it changes rarely.
const sensitivity = makeMutable(1.5);
const diagEnabled = makeMutable(false);
/** Empty until the Mac's datagram path has been confirmed. */
const datagramToken = makeMutable('');

export function syncPointerConfig(config: {
  sensitivity?: number;
  diagEnabled?: boolean;
  /** Pass an empty string to push frames back onto the JS path. */
  datagramToken?: string;
}): void {
  if (config.sensitivity != null) sensitivity.value = config.sensitivity;
  if (config.diagEnabled != null) diagEnabled.value = config.diagEnabled;
  if (config.datagramToken != null) datagramToken.value = config.datagramToken;
}

/** Reads and clears the counters. Called once a second from the JS side. */
export function drainPointerCounters(): { touches: number; sends: number } {
  const touches = touchCount.value;
  const sends = sendCount.value;
  touchCount.value = 0;
  sendCount.value = 0;
  return { touches, sends };
}

/**
 * The gesture's totals, for a frame the JS side has to send itself.
 *
 * Used before a click or a scroll: those travel on the WebSocket, ordering
 * only holds within one transport, and a cumulative frame is idempotent — the
 * Mac applies the difference, which is zero if the datagram already arrived.
 */
export function takeSyncFrame(): {
  dx: number;
  dy: number;
  cx: number;
  cy: number;
  g: number;
  seq: number;
} | null {
  if (gestureId.value === 0) return null;
  sequence.value += 1;
  const frame = {
    dx: pendingDx.value,
    dy: pendingDy.value,
    cx: cumulativeX.value,
    cy: cumulativeY.value,
    g: gestureId.value,
    seq: sequence.value,
  };
  pendingDx.value = 0;
  pendingDy.value = 0;
  return frame;
}

/**
 * Arms a new gesture; the next movement restarts the running total.
 *
 * Marked as a worklet because the drag gesture arms from the UI thread while
 * the default handlers arm from JavaScript. A function without the directive
 * throws when a worklet calls it, which is exactly what shipped.
 */
export function startPointerGesture(): void {
  'worklet';
  gestureStarting.value = true;
}

/**
 * Registered by the gesture layer. Kept as a callback so this module depends
 * on nothing that depends back on it — the socket lives behind two modules
 * that already import each other.
 */
let streamSender: ((frame: PointerMoveMessage) => void) | null = null;

export function setStreamSender(sender: (frame: PointerMoveMessage) => void): void {
  streamSender = sender;
}

/** The JS path, for when the datagram path is not confirmed. */
function sendViaJs(
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  g: number,
  seq: number,
  ts: number | null,
) {
  streamSender?.({
    v: PROTOCOL_VERSION,
    t: 'p.move',
    dx,
    dy,
    cx,
    cy,
    g,
    seq,
    ...(ts != null ? { ts } : null),
  });
}

export function flushPointer(): void {
  'worklet';
  if (pendingDx.value === 0 && pendingDy.value === 0) return;

  sequence.value += 1;
  const sentAt = now();
  lastSentAt.value = sentAt;
  sendCount.value += 1;

  const dx = pendingDx.value;
  const dy = pendingDy.value;
  const cx = cumulativeX.value;
  const cy = cumulativeY.value;
  const g = gestureId.value;
  const seq = sequence.value;
  const ts = diagEnabled.value ? sentAt : null;
  pendingDx.value = 0;
  pendingDy.value = 0;

  const token = datagramToken.value;
  if (token !== '') {
    // Straight out of the UI thread. Building the JSON here rather than
    // calling the shared encoder keeps this worklet free of imports that
    // would have to be worklet-safe themselves.
    const message =
      '{"v":' +
      PROTOCOL_VERSION +
      ',"t":"p.move","dx":' +
      dx +
      ',"dy":' +
      dy +
      ',"cx":' +
      cx +
      ',"cy":' +
      cy +
      ',"g":' +
      g +
      ',"seq":' +
      seq +
      (ts != null ? ',"ts":' + ts : '') +
      '}';
    // Reached through the global registry rather than an import: this runs on
    // the UI thread, where the module handle the JS side holds does not exist.
    // `installOnUIRuntime` is what puts this here.
    const socket = (globalThis as any)?.expo?.modules?.EntangleUdp;
    if (
      socket &&
      socket.send('{"v":' + PROTOCOL_VERSION + ',"tk":"' + token + '","m":' + message + '}')
    ) {
      return;
    }
    // The socket refused it; fall through to the JS path rather than drop it.
  }

  runOnJS(sendViaJs)(dx, dy, cx, cy, g, seq, ts);
}

export function accumulatePointer(dx: number, dy: number): void {
  'worklet';
  if (gestureStarting.value) {
    gestureStarting.value = false;
    gestureId.value += 1;
    cumulativeX.value = 0;
    cumulativeY.value = 0;
  }

  const scale = sensitivity.value;
  const scaledDx = dx * scale;
  const scaledDy = dy * scale;
  pendingDx.value += scaledDx;
  pendingDy.value += scaledDy;
  cumulativeX.value += scaledDx;
  cumulativeY.value += scaledDy;
  touchCount.value += 1;

  // No timer for the tail: at 120 Hz the next sample arrives in 8 ms and
  // flushes it, and the end of a gesture flushes explicitly. A timer in a
  // worklet runtime would be the only thing here that could not be trusted.
  if (now() - lastSentAt.value >= MIN_SEND_INTERVAL_MS) {
    flushPointer();
  }
}

/** Flushes whatever is pending, from the UI thread. */
export function endPointerGesture(): void {
  'worklet';
  flushPointer();
  gestureStarting.value = true;
}
