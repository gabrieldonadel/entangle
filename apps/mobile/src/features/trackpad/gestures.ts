import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";

import { PROTOCOL_VERSION } from "@entangle/protocol";
import type { ClientMessage } from "@entangle/protocol";

import { sendMessage, sendPointerFrame } from "@/net/send";
import { diagEnabledRef, recordSend, recordTouch } from "@/state/diag";
import {
  useNaturalScrollRef,
  usePointerSensitivityRef,
} from "@/state/settings";
import { Platform } from "react-native";

// Trackpad gesture event hooks. The same gesture configuration (thresholds,
// activation rules, haptics) drives both the production trackpad surface and
// the onboarding lesson — the lesson supplies its own handlers to mark items
// complete, while the production surface forwards events as wire messages.
export interface TrackpadHandlers {
  onMove?: (dx: number, dy: number) => void;
  onMoveEnd?: () => void;
  onTap?: () => void;
  onRightClick?: () => void;
  onDragBegin?: () => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEnd?: () => void;
  onScrollBegin?: () => void;
  onScrollChange?: (dx: number, dy: number) => void;
  onScrollEnd?: () => void;
  onSpaceSwipe?: (dir: "left" | "right") => void;
  onMissionControl?: () => void;
}

// Drag-stationarity threshold. activateAfterLongPress fires after the
// duration regardless of distance traveled, so we re-check at onStart how
// far the finger actually moved to decide whether the user meant to hold
// (arm a drag) or was just slow-swiping (normal cursor pan).
const DRAG_TRAVEL_TOLERANCE = 8;
const SWIPE_THRESHOLD_X = 50;
const SWIPE_THRESHOLD_Y = 60;

// Android capacitive touch reports small jitter on finger-down, so a pan with
// minDistance(0) activates instantly and starves the single-tap inside
// Gesture.Race. A few pixels of dead-zone lets the tap win without making the
// cursor feel sluggish.
const PAN_MIN_DISTANCE = Platform.OS === "android" ? 4 : 0;

// Drag state lives in a single-element object held by closure. RNGH builds
// gesture callbacks via Reanimated's worklet pipeline; even with
// `runOnJS(true)`, plain `let` bindings get captured by *value* at gesture
// build time, so writes inside `onStart` were invisible to `onEnd`. An
// object reference is captured stably and `.value` is always read live.
type DragState = { value: boolean };

export function createTrackpadGestures(handlers: TrackpadHandlers) {
  const dragState: DragState = { value: false };

  // Single-finger pan: cursor motion. No haptic on swipe.
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(PAN_MIN_DISTANCE)
    .onChange((event) => {
      handlers.onMove?.(event.changeX, event.changeY);
    })
    .onEnd(() => {
      handlers.onMoveEnd?.();
    })
    .runOnJS(true);

  // Long-press to arm a drag (e.g. text selection on macOS). When the user
  // holds the finger reasonably still for 450 ms, this gesture wins the race
  // ahead of `pan`. From that point on `onChange` keeps streaming motion,
  // which the Mac interprets as drag motion since the left button is now down.
  //
  // If the user instead slow-swipes for 450 ms (movement that's too small to
  // trigger `pan` immediately), this gesture also wins — but the `onStart`
  // distance check below means we treat it as a regular pan: no haptic, no
  // drag-begin. Either way `onEnd` releases the drag cleanly if it was armed.
  const dragPan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .activateAfterLongPress(450)
    .onStart((event) => {
      const traveled = Math.hypot(event.translationX, event.translationY);
      if (traveled <= DRAG_TRAVEL_TOLERANCE) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        handlers.onDragBegin?.();
        dragState.value = true;
      }
    })
    .onChange((event) => {
      if (dragState.value) {
        handlers.onDragMove?.(event.changeX, event.changeY);
      } else {
        // The long-press fired but the finger had already moved past the
        // tolerance, so we treat it as a continuation of regular panning.
        handlers.onMove?.(event.changeX, event.changeY);
      }
    })
    .onEnd(() => {
      if (dragState.value) {
        handlers.onDragEnd?.();
        dragState.value = false;
      } else {
        handlers.onMoveEnd?.();
      }
    })
    .runOnJS(true);

  const scrollPan = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .minDistance(10)
    .onStart(() => {
      handlers.onScrollBegin?.();
    })
    .onChange((event) => {
      handlers.onScrollChange?.(event.changeX, event.changeY);
    })
    .onEnd(() => {
      handlers.onScrollEnd?.();
    })
    .runOnJS(true);

  const twoFingerDoubleTap = Gesture.Tap()
    .numberOfTaps(2)
    // IOS's built-in two-finger tap for right-click is actually a three-finger
    .minPointers(Platform.OS === "ios" ? 2 : 3)
    .maxDuration(300)
    .maxDistance(15)
    .onStart(() => {
      void Haptics.selectionAsync();
      handlers.onRightClick?.();
    })
    .runOnJS(true);

  const tap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .maxDistance(8)
    .onStart(() => {
      void Haptics.selectionAsync();
      handlers.onTap?.();
    })
    .runOnJS(true);

  // Three-finger swipe — left/right to switch spaces, up to invoke Mission
  // Control. Same conventions as the macOS trackpad. We fire once per
  // swipe gesture (tracked via `swipeFired`) so a single sweep doesn't
  // step through multiple spaces.
  const swipeState = { fired: false };

  const threeFingerSwipe = Gesture.Pan()
    .minPointers(3)
    .maxPointers(3)
    .onChange((event) => {
      if (swipeState.fired) return;
      const ax = Math.abs(event.translationX);
      const ay = Math.abs(event.translationY);
      if (ax > SWIPE_THRESHOLD_X && ax > ay) {
        // macOS convention: fingers sliding LEFT advance to the next
        // (right-hand) space, fingers sliding RIGHT go back to the
        // previous one — the on-screen desktops follow the fingers.
        void Haptics.selectionAsync();
        handlers.onSpaceSwipe?.(event.translationX > 0 ? "left" : "right");
        swipeState.fired = true;
      } else if (event.translationY < -SWIPE_THRESHOLD_Y && ay > ax) {
        void Haptics.selectionAsync();
        handlers.onMissionControl?.();
        swipeState.fired = true;
      }
    })
    .onEnd(() => {
      swipeState.fired = false;
    })
    .onFinalize(() => {
      swipeState.fired = false;
    })
    .runOnJS(true);

  return Gesture.Race(
    twoFingerDoubleTap,
    tap,
    threeFingerSwipe,
    scrollPan,
    dragPan,
    pan,
  );
}

// ── Default wire-protocol handlers ──────────────────────────────────────────
// These send the events to the connected Mac. Used by the production
// TrackpadSurface; the onboarding lesson supplies its own handlers instead.

// Pointer coalescing. Gesture events can arrive faster than is worth putting
// on the wire, so deltas accumulate and go out at most every
// MIN_SEND_INTERVAL_MS.
//
// This used to flush on `requestAnimationFrame`, which pinned the send rate to
// RN's JS display link — 60 Hz in practice, even on a 120 Hz phone, and it
// added up to a frame of quantization on top. A monotonic rate limit lets the
// cadence follow touch delivery instead of the display clock.
const MIN_SEND_INTERVAL_MS = 4;

let pendingDx = 0;
let pendingDy = 0;
let pendingSeq = 0;
let lastSentAt = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Running total for the current gesture, and the gesture's number.
 *
 * Every frame carries the total, not just the change since the last one, so a
 * frame that is lost, duplicated or delivered late costs nothing: the Mac
 * applies `total - lastApplied` and the next frame carries the whole truth.
 * The gesture number travels on every frame too, so the Mac still sees the
 * boundary when the opening frame goes missing.
 */
let gestureCx = 0;
let gestureCy = 0;
let gestureId = 0;
/** Set when the next frame opens a new gesture. */
let gestureStarting = true;

/** The last frame put on the wire, for the stream copy described below. */
let lastFrame: ClientMessage | null = null;

function flushMove(alsoStream = false) {
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingDx === 0 && pendingDy === 0) return;
  pendingSeq += 1;
  lastSentAt = now();
  const frame: ClientMessage = {
    v: PROTOCOL_VERSION,
    t: "p.move",
    dx: pendingDx,
    dy: pendingDy,
    cx: gestureCx,
    cy: gestureCy,
    g: gestureId,
    seq: pendingSeq,
    // Only while diagnostics are on: the Mac uses the gap between successive
    // stamps to measure delay variation, so any monotonic clock will do.
    ...(diagEnabledRef.current ? { ts: lastSentAt } : null),
  };
  lastFrame = frame;
  sendPointerFrame(frame, alsoStream);
  recordSend();
  pendingDx = 0;
  pendingDy = 0;
}

/**
 * Flushes before a message that acts on the cursor's position — a click, a
 * drag boundary, a scroll — all of which travel on the WebSocket.
 *
 * Ordering only holds within one transport, so a click on the stream could
 * otherwise overtake the datagram that positioned the cursor and land in the
 * wrong place. Putting the positioning frame on the stream too fixes the
 * order; the duplicate costs nothing because the Mac drops whichever copy
 * arrives second.
 */
function flushMoveBeforeAction() {
  if (pendingDx !== 0 || pendingDy !== 0) {
    flushMove(true);
    return;
  }
  if (lastFrame != null) sendMessage(lastFrame);
}

/** Arms a new gesture: the next frame restarts the running total. */
function startMoveGesture() {
  gestureStarting = true;
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function accumulateMove(dx: number, dy: number) {
  if (gestureStarting) {
    gestureStarting = false;
    gestureId += 1;
    gestureCx = 0;
    gestureCy = 0;
  }
  const sensitivity = usePointerSensitivityRef.current;
  const scaledDx = dx * sensitivity;
  const scaledDy = dy * sensitivity;
  pendingDx += scaledDx;
  pendingDy += scaledDy;
  gestureCx += scaledDx;
  gestureCy += scaledDy;
  recordTouch();

  const elapsed = now() - lastSentAt;
  if (elapsed >= MIN_SEND_INTERVAL_MS) {
    flushMove();
    return;
  }
  // Too soon. Keep accumulating and make sure the tail still goes out.
  if (flushTimer == null) {
    flushTimer = setTimeout(flushMove, MIN_SEND_INTERVAL_MS - elapsed);
  }
}

let pendingScrollDx = 0;
let pendingScrollDy = 0;
let scrollRaf: number | null = null;

function flushScrollChange() {
  scrollRaf = null;
  if (pendingScrollDx === 0 && pendingScrollDy === 0) return;
  sendMessage({
    v: PROTOCOL_VERSION,
    t: "s.wheel",
    dx: pendingScrollDx,
    dy: pendingScrollDy,
    phase: "change",
  });
  pendingScrollDx = 0;
  pendingScrollDy = 0;
}

function accumulateScroll(dx: number, dy: number) {
  const factor = useNaturalScrollRef.current ? 1 : -1;
  pendingScrollDx += dx * factor;
  pendingScrollDy += dy * factor;
  if (scrollRaf == null) {
    scrollRaf = requestAnimationFrame(flushScrollChange);
  }
}

export function createDefaultTrackpadHandlers(): TrackpadHandlers {
  return {
    onMove: accumulateMove,
    onMoveEnd: () => {
      // The last frame of a gesture goes on the stream too, so whatever the
      // user does next is ordered behind the cursor's final position.
      flushMove(true);
      startMoveGesture();
    },
    onTap: () => {
      flushMoveBeforeAction();
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "p.click",
        button: "left",
        phase: "tap",
      });
    },
    onRightClick: () => {
      flushMoveBeforeAction();
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "p.click",
        button: "right",
        phase: "tap",
      });
    },
    onDragBegin: () => {
      flushMoveBeforeAction();
      startMoveGesture();
      sendMessage({ v: PROTOCOL_VERSION, t: "p.drag", phase: "begin" });
    },
    onDragMove: accumulateMove,
    onDragEnd: () => {
      flushMove(true);
      startMoveGesture();
      sendMessage({ v: PROTOCOL_VERSION, t: "p.drag", phase: "end" });
    },
    onScrollBegin: () => {
      flushMoveBeforeAction();
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "s.wheel",
        dx: 0,
        dy: 0,
        phase: "begin",
      });
    },
    onScrollChange: accumulateScroll,
    onScrollEnd: () => {
      flushScrollChange();
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "s.wheel",
        dx: 0,
        dy: 0,
        phase: "end",
      });
    },
    onSpaceSwipe: (dir) => {
      sendMessage({ v: PROTOCOL_VERSION, t: "g.space", dir });
    },
    onMissionControl: () => {
      sendMessage({ v: PROTOCOL_VERSION, t: "g.mission" });
    },
  };
}
