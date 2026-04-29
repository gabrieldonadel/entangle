import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { tokens } from '../../theme';

type Props = {
  on: boolean;
  onChange: (next: boolean) => void;
};

export function Toggle({ on, onChange }: Props) {
  return (
    <Pressable
      onPress={() => onChange(!on)}
      style={[styles.track, { backgroundColor: on ? tokens.ok : 'rgba(255,255,255,0.18)' }]}>
      <View style={[styles.thumb, { left: on ? 16 : 2 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 36,
    height: 22,
    borderRadius: 999,
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
  },
});
