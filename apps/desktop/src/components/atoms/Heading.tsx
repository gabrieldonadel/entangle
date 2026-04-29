import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, tokens } from '../../theme';

export type Density = 'cozy' | 'compact' | 'dense';

type Props = {
  title: string;
  sub?: string;
  count?: number;
  density?: Density;
};

export function Heading({ title, sub, count, density = 'compact' }: Props) {
  const padV = density === 'dense' ? 8 : density === 'compact' ? 11 : 14;
  const padH = density === 'dense' ? 16 : 18;
  const fs = density === 'dense' ? 12.5 : density === 'compact' ? 13.5 : 14;

  return (
    <View
      style={[
        styles.row,
        { paddingVertical: padV, paddingHorizontal: padH },
      ]}>
      <View style={styles.titleRow}>
        <Text
          style={[styles.title, { fontSize: fs }]}
          accessibilityRole="header">
          {title}
        </Text>
        {count !== undefined && (
          <Text style={styles.count}>{`(${count})`}</Text>
        )}
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: tokens.divider,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  title: {
    color: tokens.text,
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    letterSpacing: -0.14,
  },
  count: {
    color: tokens.textDim,
    fontWeight: '500',
    marginLeft: 2,
  },
  sub: {
    color: tokens.textDim,
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
});
