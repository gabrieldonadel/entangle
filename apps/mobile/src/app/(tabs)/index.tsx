import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TrackpadSurface } from '@/features/trackpad/TrackpadSurface';
import { useConnection } from '@/state/connection';

export default function TrackpadScreen() {
  const serverName = useConnection((s) => s.serverName);
  const phase = useConnection((s) => s.phase);
  const latency = useConnection((s) => s.latencyMs);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.connected}>Connected to</Text>
        <Text style={styles.serverName}>{serverName ?? '…'}</Text>
        <Text style={styles.meta}>
          {phase}
          {latency != null ? ` · ${latency}ms` : ''}
        </Text>
      </View>
      <TrackpadSurface />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    padding: 16,
  },
  header: {
    paddingVertical: 8,
  },
  connected: {
    color: '#8e8e93',
    fontSize: 13,
  },
  serverName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  meta: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
  },
});
