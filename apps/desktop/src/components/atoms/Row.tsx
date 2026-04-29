import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, tokens } from '../../theme';
import type { Density } from './Heading';

type Props = {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
  valueColor?: string;
  density?: Density;
};

export function Row({ k, v, mono = false, valueColor, density = 'compact' }: Props) {
  const padV = density === 'dense' ? 4 : density === 'compact' ? 6 : 9;
  const fs = density === 'dense' ? 12 : 13;

  return (
    <View
      style={[
        styles.row,
        { paddingVertical: padV },
      ]}>
      <Text style={[styles.k, { fontSize: fs }]}>{k}</Text>
      {typeof v === 'string' || typeof v === 'number' ? (
        <Text
          style={[
            styles.v,
            mono && styles.mono,
            { fontSize: mono ? (density === 'dense' ? 11.5 : 12) : fs },
            valueColor ? { color: valueColor } : null,
          ]}>
          {v}
        </Text>
      ) : (
        <View style={styles.vWrap}>{v}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  k: {
    color: tokens.textMuted,
  },
  v: {
    color: tokens.textHigh,
    fontFamily: fonts.body,
  },
  mono: {
    fontFamily: fonts.mono,
  },
  vWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
