import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useServerStore } from '../server-state';
import { fonts, tokens } from '../theme';
import { EntCard } from './atoms/EntCard';
import { Logo } from './atoms/Logo';

export function AccessibilityGate({ children }: { children: React.ReactNode }) {
  const trusted = useServerStore((s) => s.accessibilityTrusted);
  const requestAccessibility = useServerStore((s) => s.requestAccessibility);

  if (trusted) {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      <EntCard style={styles.card}>
        <View style={styles.brand}>
          <Logo size={36} />
          <Text style={styles.brandName}>Entangle</Text>
        </View>
        <Text style={styles.heading}>Accessibility permission required</Text>
        <Text style={styles.body}>
          Entangle posts mouse and keyboard events on your behalf, which macOS gates behind
          Accessibility. Grant permission to continue.
        </Text>
        <View style={styles.steps}>
          <Step n={1} text="Click “Open System Settings” below." />
          <Step n={2} text="Find Entangle in the Accessibility list and toggle it on." />
          <Step n={3} text="Return to this app — it unlocks automatically." />
        </View>
        <View style={styles.actions}>
          <Pressable
            style={styles.primary}
            onPress={() => {
              void requestAccessibility();
              Linking.openURL(
                'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
              ).catch(() => undefined);
            }}>
            <Text style={styles.primaryText}>Open System Settings</Text>
          </Pressable>
          <Pressable
            style={styles.ghost}
            onPress={() => {
              void requestAccessibility();
            }}>
            <Text style={styles.ghostText}>Re-check</Text>
          </Pressable>
        </View>
      </EntCard>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{`0${n}`}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    paddingVertical: 28,
    paddingHorizontal: 32,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  brandName: {
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    fontSize: 18,
    letterSpacing: -0.36,
    color: tokens.text,
  },
  heading: {
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    fontSize: 22,
    letterSpacing: -0.44,
    color: tokens.text,
    marginBottom: 10,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 21,
    color: tokens.textMid,
    marginBottom: 18,
  },
  steps: {
    marginBottom: 22,
    gap: 6,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: tokens.accent,
    width: 24,
    letterSpacing: 0.66,
  },
  stepText: {
    fontSize: 13,
    color: tokens.textMid,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  primary: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  primaryText: {
    color: '#0e1014',
    fontWeight: '500',
    fontSize: 13,
  },
  ghost: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ghostText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
});
