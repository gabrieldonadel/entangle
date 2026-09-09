import { create } from 'zustand';
import { summarize } from '@entangle/protocol';
import type { DiagStateMessage } from '@entangle/protocol';

/**
 * Pointer-path diagnostics. Off by default.
 *
 * Split in two on purpose: the phone can only honestly measure what it does
 * itself (how often it sends, and the round trip), and the Mac reports what
 * happens on its side. Nothing here tries to compare the two clocks.
 */

/**
 * Read on every pointer flush, so it is a plain ref rather than a store read.
 * Mirrors the pattern in `settings.ts`.
 */
export const diagEnabledRef = { current: false };

export interface MacDiag {
  rate: number;
  gapP50: number;
  gapP95: number;
  jitter: number;
  procP50: number;
  procP95: number;
  stalls: number;
}

export type Transport = 'off' | 'probing' | 'active';

interface DiagState {
  enabled: boolean;
  /** Which wire pointer frames are currently taking. */
  transport: Transport;
  /** Raw gesture callbacks in the last second, before coalescing. */
  touchRate: number;
  /** Where the Mac is writing the log, once it has told us. */
  logPath: string | null;
  /** Pointer messages the phone put on the wire in the last second. */
  sendRate: number;
  /** Round trip measured by the phone, milliseconds. */
  rttP50: number;
  rttP95: number;
  /** Last snapshot from the Mac, or null until one arrives. */
  mac: MacDiag | null;
  setEnabled: (enabled: boolean) => void;
  applyRemote: (msg: DiagStateMessage) => void;
  reset: () => void;
}

/** Sends since the last tick. A plain counter: no re-render per frame. */
let sentSinceTick = 0;
/** Gesture callbacks since the last tick. */
let touchesSinceTick = 0;
/** Round trips since the last tick. */
let rttSamples: number[] = [];

export const useDiag = create<DiagState>((set) => ({
  enabled: false,
  transport: 'off',
  logPath: null,
  touchRate: 0,
  sendRate: 0,
  rttP50: 0,
  rttP95: 0,
  mac: null,
  setEnabled: (enabled) => {
    diagEnabledRef.current = enabled;
    sentSinceTick = 0;
    touchesSinceTick = 0;
    rttSamples = [];
    set({
      enabled,
      sendRate: 0,
      touchRate: 0,
      rttP50: 0,
      rttP95: 0,
      mac: null,
      logPath: null,
    });
  },
  applyRemote: (msg) =>
    set((state) => ({
      logPath: msg.logPath ?? state.logPath,
      mac: {
        rate: msg.rate,
        gapP50: msg.gapP50,
        gapP95: msg.gapP95,
        jitter: msg.jitter,
        procP50: msg.procP50,
        procP95: msg.procP95,
        stalls: msg.stalls,
      },
    })),
  reset: () => {
    diagEnabledRef.current = false;
    sentSinceTick = 0;
    touchesSinceTick = 0;
    rttSamples = [];
    set({
      enabled: false,
      sendRate: 0,
      touchRate: 0,
      rttP50: 0,
      rttP95: 0,
      mac: null,
      logPath: null,
    });
  },
}));

/** Called from the pointer flush. Deliberately does not touch the store. */
export function recordSend() {
  if (!diagEnabledRef.current) return;
  sentSinceTick += 1;
}

/**
 * Called from the gesture callback, before coalescing. Also deliberately
 * store-free: this is the hottest callback in the app.
 */
export function recordTouch() {
  if (!diagEnabledRef.current) return;
  touchesSinceTick += 1;
}

export function recordRtt(ms: number) {
  if (!diagEnabledRef.current) return;
  rttSamples.push(ms);
}

export interface PhoneStats {
  sendRate: number;
  touchRate: number;
  rttP50: number;
  rttP95: number;
}

/**
 * Rolls one second of phone-side counters into the store and returns them, so
 * the caller can put the same figures on the wire for the Mac's log.
 *
 * The connection owns the timer rather than this module, so the displayed
 * numbers and the reported ones are always the same second — and so this
 * store never has to import the socket.
 */
export function tickPhoneStats(): PhoneStats {
  const sendRate = sentSinceTick;
  const touchRate = touchesSinceTick;
  const samples = rttSamples;
  sentSinceTick = 0;
  touchesSinceTick = 0;
  rttSamples = [];
  const { p50, p95 } = summarize(samples);
  const state = useDiag.getState();
  // Keep the last reading when a second passes with no round trip, rather
  // than blinking to zero between pings.
  const rttP50 = samples.length > 0 ? p50 : state.rttP50;
  const rttP95 = samples.length > 0 ? p95 : state.rttP95;
  useDiag.setState({ sendRate, touchRate, rttP50, rttP95 });
  return { sendRate, touchRate, rttP50, rttP95 };
}
