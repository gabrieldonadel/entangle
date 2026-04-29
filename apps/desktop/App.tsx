import React, { useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AccessibilityGate } from './src/components/AccessibilityGate';
import { ConnectedPhones } from './src/components/ConnectedPhones';
import { Header } from './src/components/Header';
import { PairingSheet } from './src/components/PairingSheet';
import { PreferencesSheet } from './src/components/PreferencesSheet';
import { ServerCard } from './src/components/ServerCard';
import { Halos } from './src/components/atoms/Halos';
import { InfoNotice } from './src/components/atoms/InfoNotice';
import { useServerStore } from './src/server-state';
import { tokens } from './src/theme';

function App(): React.JSX.Element {
  const start = useServerStore((s) => s.start);
  const phase = useServerStore((s) => s.phase);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    if (phase === 'idle') {
      void start();
    }
  }, [phase, start]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.root}>
        <Halos />
        <AccessibilityGate>
          <ScrollView contentContainerStyle={styles.content}>
            <Header />
            <ServerCard />
            <ConnectedPhones onPairNew={() => setPairingOpen(true)} />
            <InfoNotice onConfigure={() => setPreferencesOpen(true)} />
          </ScrollView>
          <PairingSheet visible={pairingOpen} onClose={() => setPairingOpen(false)} />
          <PreferencesSheet visible={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
        </AccessibilityGate>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.bg0,
  },
  content: {
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
});

export default App;
