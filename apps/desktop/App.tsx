import React, { useEffect } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AccessibilityGate } from './src/components/AccessibilityGate';
import { ConnectedClients } from './src/components/ConnectedClients';
import { ServerStatus } from './src/components/ServerStatus';
import { useServerStore } from './src/server-state';

function App(): React.JSX.Element {
  const start = useServerStore((s) => s.start);
  const phase = useServerStore((s) => s.phase);

  useEffect(() => {
    if (phase === 'idle') {
      void start();
    }
  }, [phase, start]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.root}>
        <AccessibilityGate>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.heading}>Entangle</Text>
            <Text style={styles.subheading}>Remote mouse for macOS</Text>
            <ServerStatus />
            <ConnectedClients />
            <View style={styles.footerCard}>
              <Text style={styles.footerText}>
                This Mac is advertising on your local network. Any device on the same Wi-Fi can connect without pairing.
              </Text>
            </View>
          </ScrollView>
        </AccessibilityGate>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    padding: 24,
  },
  heading: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  subheading: {
    color: '#8e8e93',
    fontSize: 16,
    marginBottom: 24,
  },
  footerCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
  },
  footerText: {
    color: '#ff9f0a',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default App;
