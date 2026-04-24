import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConnection } from '@/state/connection';

export default function SettingsScreen() {
  const phase = useConnection((s) => s.phase);
  const target = useConnection((s) => s.target);
  const serverName = useConnection((s) => s.serverName);
  const latency = useConnection((s) => s.latencyMs);
  const disconnect = useConnection((s) => s.disconnect);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Connection</Text>
        <Row label="Status" value={phase} />
        <Row label="Server" value={serverName ?? '—'} />
        <Row label="Host" value={target ? `${target.host}:${target.port}` : '—'} />
        <Row label="Latency" value={latency != null ? `${latency} ms` : '—'} />
      </View>

      <Pressable style={styles.disconnect} onPress={disconnect}>
        <Text style={styles.disconnectText}>Disconnect</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', padding: 16 },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: '#8e8e93' },
  value: { color: '#fff', fontVariant: ['tabular-nums'] },
  disconnect: {
    marginTop: 24,
    padding: 14,
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    alignItems: 'center',
  },
  disconnectText: { color: '#ff453a', fontSize: 15, fontWeight: '600' },
});
