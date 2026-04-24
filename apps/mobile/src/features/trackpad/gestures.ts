import { Gesture } from 'react-native-gesture-handler';

import { PROTOCOL_VERSION } from '@entangle/protocol';

import { sendMessage } from '@/net/send';
import { usePointerSensitivityRef } from '@/state/settings';

let pendingDx = 0;
let pendingDy = 0;
let pendingSeq = 0;
let rafHandle: number | null = null;
let lastX = 0;
let lastY = 0;

function flushMove() {
  rafHandle = null;
  if (pendingDx === 0 && pendingDy === 0) return;
  pendingSeq += 1;
  sendMessage({
    v: PROTOCOL_VERSION,
    t: 'p.move',
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
  if (rafHandle == null) {
    rafHandle = requestAnimationFrame(flushMove);
  }
}

export function createTrackpadGestures() {
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      lastX = event.x;
      lastY = event.y;
    })
    .onUpdate((event) => {
      const dx = event.x - lastX;
      const dy = event.y - lastY;
      lastX = event.x;
      lastY = event.y;
      accumulateMove(dx, dy);
    })
    .onEnd(() => {
      flushMove();
    })
    .runOnJS(true);

  const tap = Gesture.Tap()
    .maxDuration(250)
    .numberOfTaps(1)
    .onStart(() => {
      sendMessage({ v: PROTOCOL_VERSION, t: 'p.click', button: 'left', phase: 'tap' });
    })
    .runOnJS(true);

  const twoFingerTap = Gesture.Tap()
    .maxDuration(250)
    .numberOfTaps(1)
    .minPointers(2)
    .onStart(() => {
      sendMessage({ v: PROTOCOL_VERSION, t: 'p.click', button: 'right', phase: 'tap' });
    })
    .runOnJS(true);

  return Gesture.Exclusive(twoFingerTap, tap, pan);
}
