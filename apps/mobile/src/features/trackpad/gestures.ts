import * as Haptics from "expo-haptics";
import { Gesture } from "react-native-gesture-handler";

import { PROTOCOL_VERSION } from "@entangle/protocol";

import { sendMessage } from "@/net/send";
import {
  useNaturalScrollRef,
  usePointerSensitivityRef,
} from "@/state/settings";

// Pointer coalescing ---------------------------------------------------------

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

// Scroll coalescing ----------------------------------------------------------

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

// Gesture composition --------------------------------------------------------

export function createTrackpadGestures() {
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(0)
    .onChange((event) => {
      accumulateMove(event.changeX, event.changeY);
    })
    .onEnd(() => {
      flushMove();
    })
    .runOnJS(true);

  const dragPan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .activateAfterLongPress(400)
    .onStart(() => {
      sendMessage({ v: PROTOCOL_VERSION, t: "p.drag", phase: "begin" });
      void Haptics.impactAsync();
    })
    .onChange((event) => {
      accumulateMove(event.changeX, event.changeY);
    })
    .onEnd(() => {
      flushMove();
      sendMessage({ v: PROTOCOL_VERSION, t: "p.drag", phase: "end" });
    })
    .runOnJS(true);

  const scrollPan = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .minDistance(0)
    .onStart(() => {
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "s.wheel",
        dx: 0,
        dy: 0,
        phase: "begin",
      });
    })
    .onChange((event) => {
      accumulateScroll(event.changeX, event.changeY);
    })
    .onEnd(() => {
      flushScrollChange();
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "s.wheel",
        dx: 0,
        dy: 0,
        phase: "end",
      });
    })
    .runOnJS(true);

  const tap = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(8)
    .numberOfTaps(1)
    .onStart(() => {
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "p.click",
        button: "left",
        phase: "tap",
      });
    })
    .runOnJS(true);

  const twoFingerTap = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(12)
    .numberOfTaps(1)
    .minPointers(2)
    .onStart(() => {
      sendMessage({
        v: PROTOCOL_VERSION,
        t: "p.click",
        button: "right",
        phase: "tap",
      });
    })
    .runOnJS(true);

  return Gesture.Race(twoFingerTap, tap, scrollPan, dragPan, pan);
}
