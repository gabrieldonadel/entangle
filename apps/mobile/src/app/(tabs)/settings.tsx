import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConnection } from '@/state/connection';
import { useSettings } from '@/state/settings';

const SENSITIVITY_PRESETS = [
  { label: 'Slow', value: 1.0 },
  { label: 'Normal', value: 1.5 },
  { label: 'Fast', value: 2.5 },
] as const;

export default function SettingsScreen() {
  const phase = useConnection((s) => s.phase);
  const target = useConnection((s) => s.target);
  const serverName = useConnection((s) => s.serverName);
  const latency = useConnection((s) => s.latencyMs);
  const disconnect = useConnection((s) => s.disconnect);
  const pointerSensitivity = useSettings((s) => s.pointerSensitivity);
  const setPointerSensitivity = useSettings((s) => s.setPointerSensitivity);
  const naturalScroll = useSettings((s) => s.naturalScroll);
  const setNaturalScroll = useSettings((s) => s.setNaturalScroll);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Connection</Text>
        <Row label="Status" value={phase} />
        <Row label="Server" value={serverName ?? '—'} />
        <Row label="Host" value={target ? `${target.host}:${target.port}` : '—'} />
        <Row label="Latency" value={latency != null ? `${latency} ms` : '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Pointer sensitivity</Text>
        <View style={styles.presets}>
          {SENSITIVITY_PRESETS.map((preset) => {
            const selected = Math.abs(pointerSensitivity - preset.value) < 0.01;
            return (
              <Pressable
                key={preset.label}
                style={[styles.preset, selected && styles.presetSelected]}
                onPress={() => setPointerSensitivity(preset.value)}>
                <Text style={[styles.presetText, selected && styles.presetTextSelected]}>
                  {preset.label}
                </Text>
                <Text style={styles.presetValue}>{preset.value.toFixed(1)}×</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabels}>
            <Text style={styles.toggleTitle}>Natural scroll</Text>
            <Text style={styles.toggleSubtitle}>
              Content follows fingers. Turn off if scroll feels inverted on your Mac.
            </Text>
          </View>
          <Switch value={naturalScroll} onValueChange={setNaturalScroll} />
        </View>
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
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: '#8e8e93' },
  value: { color: '#fff', fontVariant: ['tabular-nums'] },
  presets: {
    flexDirection: 'row',
    gap: 8,
  },
  preset: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
  },
  presetSelected: {
    backgroundColor: '#0a84ff',
  },
  presetText: {
    color: '#d1d1d6',
    fontSize: 14,
    fontWeight: '600',
  },
  presetTextSelected: {
    color: '#fff',
  },
  presetValue: {
    color: '#8e8e93',
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toggleLabels: {
    flex: 1,
  },
  toggleTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  disconnect: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    alignItems: 'center',
  },
  disconnectText: { color: '#ff453a', fontSize: 15, fontWeight: '600' },
});
