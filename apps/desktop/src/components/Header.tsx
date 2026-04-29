import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import pkg from '../../package.json';
import { useServerStore } from '../server-state';
import { fonts, tokens } from '../theme';
import { Logo } from './atoms/Logo';
import { StatusPill } from './atoms/StatusPill';

const APP_VERSION = pkg.version;

export function Header() {
  const phase = useServerStore((s) => s.phase);
  const start = useServerStore((s) => s.start);
  const stop = useServerStore((s) => s.stop);
  const paused = phase === 'idle' || phase === 'error';
  const running = phase === 'running';

  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <Logo size={32} />
        <View>
          <Text style={styles.name}>Entangle</Text>
          <Text style={styles.subtitle}>Remote mouse for macOS · v{APP_VERSION}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <StatusPill tone={running ? 'ok' : paused ? 'idle' : 'info'}>
          {running ? 'running' : phase === 'starting' ? 'starting' : 'paused'}
        </StatusPill>
        <Pressable
          onPress={() => {
            if (running) void stop();
            else void start();
          }}
          style={({ pressed }) => [
            styles.button,
            paused && styles.buttonAccent,
            pressed && { opacity: 0.85 },
          ]}>
          {paused ? (
            <>
              <Svg width={11} height={11} viewBox="0 0 24 24">
                <Path d="M8 5v14l11-7z" fill={tokens.accent} />
              </Svg>
              <Text style={[styles.buttonLabel, { color: tokens.accent }]}>Resume</Text>
            </>
          ) : (
            <>
              <Svg width={11} height={11} viewBox="0 0 24 24">
                <Rect x={6} y={5} width={4} height={14} fill={tokens.text} />
                <Rect x={14} y={5} width={4} height={14} fill={tokens.text} />
              </Svg>
              <Text style={styles.buttonLabel}>Pause</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingTop: 22,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: -0.36,
    color: tokens.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  buttonAccent: {
    backgroundColor: 'rgba(163,187,214,0.16)',
    borderColor: 'rgba(163,187,214,0.3)',
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.85)',
  },
});
