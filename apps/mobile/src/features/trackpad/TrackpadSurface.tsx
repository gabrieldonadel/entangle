import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

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

export function TrackpadSurface({ onLocalGesture }: TrackpadSurfaceProps = {}) {
  const gesture = useMemo(() => {
    const defaults = createDefaultTrackpadHandlers();
    if (!onLocalGesture) return createTrackpadGestures(defaults);
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
  }, [onLocalGesture]);

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
