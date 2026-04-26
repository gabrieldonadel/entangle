import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { createTrackpadGestures } from './gestures';

export function TrackpadSurface() {
  const gesture = useMemo(() => createTrackpadGestures(), []);

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
