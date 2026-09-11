import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useFrameCallback } from 'react-native-reanimated';

import { useDiag } from '@/state/diag';

import { createDefaultTrackpadHandlers, createTrackpadGestures } from './gestures';

export type LocalGestureEvent =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'scroll'; dx: number; dy: number }
  | { type: 'tap' }
  | { type: 'rightClick' };

export interface TrackpadSurfaceProps {
  /**
   * Demo-mode tap-through. When provided, gesture events are forwarded
   * here in addition to the wire protocol — used by the demo trackpad
   * screen to animate a local virtual cursor on the Mini Mac preview.
   * The wire calls remain in place but no-op when the socket is closed.
   */
  onLocalGesture?: (event: LocalGestureEvent) => void;
}

/** Keeps the display awake for a moment after the finger lifts, so a flurry
 *  of short swipes does not ramp the panel up and down between each one. */
const REFRESH_IDLE_MS = 1000;

export function TrackpadSurface({ onLocalGesture }: TrackpadSurfaceProps = {}) {
  const uiThreadPointer = useDiag((s) => s.uiThreadPointer);
  const highRefresh = useDiag((s) => s.highRefresh);

  // An empty frame callback, purely to hold the display link open. Worklets
  // runs its link at CAFrameRateRange(60, 120, 120) on a ProMotion screen and
  // steps down when callbacks get expensive — this one costs nothing, so the
  // panel stays at its maximum while a finger is down, and iOS delivers
  // touches in step with the panel.
  const frameCallback = useFrameCallback(() => {
    'worklet';
  }, false);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTouchActive = useCallback(
    (active: boolean) => {
      if (idleTimer.current) {
        clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
      if (active) {
        if (highRefresh && !frameCallback.isActive) frameCallback.setActive(true);
        return;
      }
      idleTimer.current = setTimeout(() => {
        idleTimer.current = null;
        if (frameCallback.isActive) frameCallback.setActive(false);
      }, REFRESH_IDLE_MS);
    },
    [frameCallback, highRefresh],
  );

  // Turning the switch off mid-session should let the display settle back
  // down rather than wait for the next gesture.
  useEffect(() => {
    if (!highRefresh && frameCallback.isActive) frameCallback.setActive(false);
  }, [highRefresh, frameCallback]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (frameCallback.isActive) frameCallback.setActive(false);
    };
  }, [frameCallback]);

  const gesture = useMemo(() => {
    const defaults = createDefaultTrackpadHandlers();
    // Demo mode needs a JavaScript callback per event to animate its own
    // cursor, so it keeps the JS path; the real trackpad does not.
    if (!onLocalGesture) {
      return createTrackpadGestures(defaults, {
        uiThread: uiThreadPointer,
        onTouchActivity: setTouchActive,
      });
    }
    return createTrackpadGestures({
      ...defaults,
      onMove: (dx, dy) => {
        defaults.onMove?.(dx, dy);
        onLocalGesture({ type: 'move', dx, dy });
      },
      onDragMove: (dx, dy) => {
        defaults.onDragMove?.(dx, dy);
        onLocalGesture({ type: 'move', dx, dy });
      },
      onScrollChange: (dx, dy) => {
        defaults.onScrollChange?.(dx, dy);
        onLocalGesture({ type: 'scroll', dx, dy });
      },
      onTap: () => {
        defaults.onTap?.();
        onLocalGesture({ type: 'tap' });
      },
      onRightClick: () => {
        defaults.onRightClick?.();
        onLocalGesture({ type: 'rightClick' });
      },
    });
  }, [onLocalGesture, uiThreadPointer, setTouchActive]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.surface}>
        <Text style={styles.hint}>
          Drag · Tap · Double 2-finger tap = right-click · 2-finger drag = scroll · Hold then drag
        </Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
    justifyContent: 'flex-end',
    padding: 20,
  },
  hint: {
    color: '#3a3a3c',
    fontSize: 12,
    textAlign: 'center',
  },
});
