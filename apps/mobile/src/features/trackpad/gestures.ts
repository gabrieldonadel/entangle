import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";

import { PROTOCOL_VERSION } from "@entangle/protocol";

import { sendMessage } from "@/net/send";
import {
  useNaturalScrollRef,
  usePointerSensitivityRef,
} from "@/state/settings";

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
    .minDistance(0)
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
    .minPointers(2)
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

// Pointer coalescing: gesture events fire faster than we want to send. RAF
// batches them into one wire message per frame.
let pendingDx = 0;
let pendingDy = 0;
let pendingSeq = 0;
let moveRaf: number | null = null;

function flushMove() {
  moveRaf = null;
  if (pendingDx === 0 && pendingDy === 0) return;
  pendingSeq += 1;
  sendMessage({
    v: PROTOCOL_VERSION,
    t: "p.move",
    dx: pendingDx,
    dy: pendingDy,
    seq: pendingSeq,
  });
  pendingDx = 0;
  pendingDy = 0;
}

function accumulateMove(dx: number, dy: number) {
  const sensitivity = usePointerSensitivityRef.current;
  pendingDx += dx * sensitivity;
  pendingDy += dy * sensitivity;
  if (moveRaf == null) {
    moveRaf = requestAnimationFrame(flushMove);
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
    onMoveEnd: flushMove,
    onDragBegin: () => {
      sendMessage({ v: PROTOCOL_VERSION, t: "p.drag", phase: "begin" });
    },
    onDragMove: accumulateMove,
    onDragEnd: () => {
      flushMove();
      sendMessage({ v: PROTOCOL_VERSION, t: "p.drag", phase: "end" });
    },
    onScrollBegin: () => {
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
    onTap: () => {
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "p.click",
        button: "left",
        phase: "tap",
      });
    },
    onRightClick: () => {
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "p.click",
        button: "right",
        phase: "tap",
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
