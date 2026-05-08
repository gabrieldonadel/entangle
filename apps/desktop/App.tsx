import React, { useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AccessibilityGate } from './src/components/AccessibilityGate';
import { ConnectedPhones } from './src/components/ConnectedPhones';
import { DeviceMenuSheet } from './src/components/DeviceMenuSheet';
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
  const clients = useServerStore((s) => s.clients);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [menuClientId, setMenuClientId] = useState<string | null>(null);
  const menuClient = menuClientId ? clients[menuClientId] ?? null : null;

  useEffect(() => {
    if (phase === 'idle') {
      void start();
    }
  }, [phase, start]);

  // If the active device disconnects while its menu is open, close the sheet.
  useEffect(() => {
    if (menuClientId && !clients[menuClientId]) {
      setMenuClientId(null);
    }
  }, [menuClientId, clients]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.root}>
        <Halos />
        <AccessibilityGate>
          <ScrollView contentContainerStyle={styles.content}>
            <Header />
            <ServerCard />
            <ConnectedPhones
              onPairNew={() => setPairingOpen(true)}
              onOpenDeviceMenu={setMenuClientId}
            />
            <InfoNotice onConfigure={() => setPreferencesOpen(true)} />
          </ScrollView>
          <PairingSheet visible={pairingOpen} onClose={() => setPairingOpen(false)} />
          <PreferencesSheet visible={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
          <DeviceMenuSheet client={menuClient} onClose={() => setMenuClientId(null)} />
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
