import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useServerStore } from '../server-state';

export function AccessibilityGate({ children }: { children: React.ReactNode }) {
  const trusted = useServerStore((s) => s.accessibilityTrusted);
  const requestAccessibility = useServerStore((s) => s.requestAccessibility);

  if (trusted) {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.heading}>Accessibility permission required</Text>
        <Text style={styles.body}>
          Entangle posts mouse and keyboard events on your behalf, which macOS gates behind
          Accessibility. Grant permission to continue.
        </Text>
        <Text style={styles.steps}>
          1. Click “Open System Settings” below.{'\n'}
          2. Find Entangle in the Accessibility list and toggle it on.{'\n'}
          3. Return to this app — it unlocks automatically.
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.primary]}
            onPress={() => {
              void requestAccessibility();
              Linking.openURL(
                'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
              ).catch(() => undefined);
            }}>
            <Text style={styles.primaryText}>Open System Settings</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondary]}
            onPress={() => {
              void requestAccessibility();
            }}>
            <Text style={styles.secondaryText}>Re-check</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 24,
    backgroundColor: '#000',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 20,
  },
  heading: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  body: {
    color: '#d1d1d6',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  steps: {
    color: '#8e8e93',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primary: { backgroundColor: '#0a84ff' },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { backgroundColor: '#2c2c2e' },
  secondaryText: { color: '#fff' },
});
