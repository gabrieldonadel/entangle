import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  size?: number;
  accent?: string;
};

export function MiniPhone({ size = 36, accent = '#a3bbd6' }: Props) {
  const height = size * 1.6;
  return (
    <LinearGradient
      colors={['#2a2d34', '#14171d']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[
        styles.body,
        {
          width: size,
          height,
          borderRadius: size * 0.18,
          padding: 2.5,
        },
      ]}>
      <View
        style={[
          styles.screen,
          { borderRadius: size * 0.14 },
        ]}>
        <View
          style={[
            styles.notch,
            {
              top: 3,
              width: size * 0.32,
              height: size * 0.06,
            },
          ]}
        />
        <View
          style={[
            styles.glow,
            {
              borderRadius: size * 0.1,
              backgroundColor: accent + '22',
            },
          ]}
        />
        <View
          style={[
            styles.orb,
            {
              left: size / 2 - size * 0.14,
              top: height / 2 - size * 0.14 - 2.5,
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              backgroundColor: accent,
              shadowColor: accent,
              shadowRadius: size * 0.3,
              shadowOpacity: 0.4,
            },
          ]}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  body: {
    overflow: 'hidden',
  },
  screen: {
    flex: 1,
    backgroundColor: '#0a0a0d',
    overflow: 'hidden',
    position: 'relative',
  },
  notch: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -7 }],
    backgroundColor: '#000',
    borderRadius: 999,
  },
  glow: {
    position: 'absolute',
    top: 8,
    left: 6,
    right: 6,
    bottom: 6,
    opacity: 0.6,
  },
  orb: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
  },
});
