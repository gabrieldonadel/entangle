import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fonts, tokens } from '../../theme';

type Props = {
  ssid?: string | null;
  onConfigure?: () => void;
};

export function InfoNotice({ ssid, onConfigure }: Props) {
  const networkLabel = ssid ?? 'your local Wi-Fi';
  return (
    <View style={styles.notice}>
      <Svg width={16} height={16} viewBox="0 0 24 24" style={styles.icon}>
        <Circle cx={12} cy={12} r={9} stroke={tokens.accent} strokeWidth={1.8} fill="none" />
        <Path d="M12 8v4M12 16h.01" stroke={tokens.accent} strokeWidth={1.8} fill="none" />
      </Svg>
      <Text style={styles.body}>
        <Text style={styles.bodyStrong}>This Mac is discoverable on your local Wi-Fi.</Text>{' '}
        Anyone on{' '}
        <Text style={styles.network}>{networkLabel}</Text>
        {' '}can request to pair. Each new device asks for confirmation here.
      </Text>
      {onConfigure ? (
        <Pressable style={styles.button} onPress={onConfigure}>
          <Text style={styles.buttonLabel}>Configure</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: tokens.accentSoft,
    borderWidth: 1,
    borderColor: tokens.accentBorder,
    borderRadius: 10,
  },
  icon: {
    marginTop: 1,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 19,
    color: tokens.textMid,
  },
  bodyStrong: {
    color: tokens.textHigh,
    fontWeight: '500',
  },
  network: {
    fontFamily: fonts.mono,
    color: tokens.accent,
  },
  button: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  buttonLabel: {
    fontSize: 11.5,
    color: tokens.textMid,
  },
});
