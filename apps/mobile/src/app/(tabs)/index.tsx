import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

      <View style={styles.surface}>
        <Text style={styles.placeholder}>Trackpad</Text>
        <Text style={styles.placeholderHint}>Pointer gestures land in Phase B.</Text>
      </View>
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
  surface: {
    flex: 1,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  placeholderHint: {
    color: '#8e8e93',
    marginTop: 6,
  },
});
