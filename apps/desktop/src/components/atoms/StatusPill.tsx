import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, tokens } from '../../theme';

type Tone = 'ok' | 'warn' | 'info' | 'idle';

const tones: Record<
  Tone,
  { dot: string; text: string; bg: string; border: string }
> = {
  ok: {
    dot: tokens.ok,
    text: tokens.okText,
    bg: 'rgba(52,199,89,0.10)',
    border: 'rgba(52,199,89,0.20)',
  },
  warn: {
    dot: tokens.warn,
    text: '#f0c178',
    bg: 'rgba(255,179,64,0.10)',
    border: 'rgba(255,179,64,0.20)',
  },
  info: {
    dot: tokens.accent,
    text: tokens.accent,
    bg: tokens.accentSoft,
    border: 'rgba(163,187,214,0.22)',
  },
  idle: {
    dot: '#5a6378',
    text: '#8a93a6',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
  },
};

type Props = {
  tone?: Tone;
  children: React.ReactNode;
};

export function StatusPill({ tone = 'ok', children }: Props) {
  const c = tones[tone];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}>
      <View
        style={[
          styles.dot,
          {
            backgroundColor: c.dot,
            shadowColor: c.dot,
          },
        ]}
      />
      <Text style={[styles.text, { color: c.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 999,
    borderWidth: 1,
    gap: 7,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  text: {
    fontSize: 10.5,
    fontFamily: fonts.mono,
    letterSpacing: 0.4,
    textTransform: 'lowercase',
  },
});
