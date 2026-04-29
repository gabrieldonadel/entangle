import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { fonts, tokens } from '../theme';
import { EntCard } from './atoms/EntCard';
import { Heading } from './atoms/Heading';
import { MiniPhone } from './atoms/MiniPhone';

type Props = {
  onShowPairing?: () => void;
};

export function EmptyPhones({ onShowPairing }: Props) {
  return (
    <EntCard style={styles.card}>
      <Heading title="Connected phones" count={0} density="compact" />
      <View style={styles.body}>
        <View style={styles.copy}>
          <Text style={styles.heading}>No phones paired yet.</Text>
          <Text style={styles.lede}>
            Open <Text style={styles.strong}>Entangle</Text> on your iPhone — it'll find this Mac
            on Wi-Fi automatically. Or scan a one-time code if you'd rather skip discovery.
          </Text>
          <View style={styles.actions}>
            {onShowPairing ? (
              <Pressable onPress={onShowPairing} style={styles.primary}>
                <Svg width={13} height={13} viewBox="0 0 24 24">
                  <Rect x={3} y={3} width={7} height={7} fill="none" stroke="#0e1014" strokeWidth={2} />
                  <Rect x={14} y={3} width={7} height={7} fill="none" stroke="#0e1014" strokeWidth={2} />
                  <Rect x={3} y={14} width={7} height={7} fill="none" stroke="#0e1014" strokeWidth={2} />
                  <Path d="M14 14h3v3M21 14v7M14 17v4" stroke="#0e1014" strokeWidth={2} fill="none" />
                </Svg>
                <Text style={styles.primaryLabel}>Show pairing code</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.ghost}>
              <Svg width={13} height={13} viewBox="0 0 24 24">
                <Path
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                  fill={tokens.text}
                />
              </Svg>
              <Text style={styles.ghostLabel}>Get the iPhone app</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.phantomWrap}>
          <View style={styles.phantom}>
            <MiniPhone size={88} />
          </View>
          <View style={styles.phantomRing} pointerEvents="none" />
          <Text style={styles.phantomLabel}>awaiting first device</Text>
        </View>
      </View>
    </EntCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  body: {
    paddingTop: 44,
    paddingBottom: 36,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  copy: {
    flex: 1,
  },
  heading: {
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    fontSize: 22,
    letterSpacing: -0.44,
    color: tokens.text,
    marginBottom: 8,
  },
  lede: {
    fontSize: 13.5,
    lineHeight: 21,
    color: tokens.textMid,
    marginBottom: 18,
    maxWidth: 460,
  },
  strong: {
    color: tokens.text,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  primaryLabel: {
    color: '#0e1014',
    fontWeight: '500',
    fontSize: 13,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ghostLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  phantomWrap: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  phantom: {
    opacity: 0.18,
  },
  phantomRing: {
    position: 'absolute',
    top: -4,
    left: 0,
    right: 0,
    bottom: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
  },
  phantomLabel: {
    marginTop: 8,
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.95,
    textTransform: 'uppercase',
  },
});
