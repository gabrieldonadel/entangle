import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { tokens } from '../../theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export function EntCard({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
