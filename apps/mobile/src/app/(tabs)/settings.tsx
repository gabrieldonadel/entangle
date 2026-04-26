import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { PROTOCOL_VERSION } from '@entangle/protocol';

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
  const serverVersion = useConnection((s) => s.serverVersion);
  const serverCaps = useConnection(useShallow((s) => s.serverCaps));
  const latency = useConnection((s) => s.latencyMs);
  const disconnect = useConnection((s) => s.disconnect);
  const pointerSensitivity = useSettings((s) => s.pointerSensitivity);
  const setPointerSensitivity = useSettings((s) => s.setPointerSensitivity);
  const naturalScroll = useSettings((s) => s.naturalScroll);
  const setNaturalScroll = useSettings((s) => s.setNaturalScroll);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Connection</Text>
          <Row label="Status" value={phase} />
          <Row label="Server" value={serverName ?? '—'} />
          <Row label="Host" value={target ? `${target.host}:${target.port}` : '—'} />
          <Row label="Latency" value={latency != null ? `${latency} ms` : '—'} />
          <Row label="Server version" value={serverVersion ?? '—'} />
          <Row label="Protocol" value={`v${PROTOCOL_VERSION}`} />
          <Row
            label="Capabilities"
            value={serverCaps.length ? serverCaps.join(', ') : '—'}
          />
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

        <View style={styles.card}>
          <Text style={styles.title}>Spaces &amp; Mission Control</Text>
          <Text style={styles.hint}>
            Use the buttons at the bottom of the Dock tab to switch Spaces or open Mission
            Control. They send the default macOS keyboard shortcuts below, so make sure they
            are enabled in System Settings → Keyboard → Keyboard Shortcuts → Mission Control.
          </Text>
          <ShortcutRow gesture="Prev Space" shortcut="⌃←" action="Previous Space" />
          <ShortcutRow gesture="Next Space" shortcut="⌃→" action="Next Space" />
          <ShortcutRow gesture="Mission" shortcut="⌃↑" action="Mission Control" />
        </View>

        <Pressable style={styles.disconnect} onPress={disconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ShortcutRow({
  gesture,
  shortcut,
  action,
}: {
  gesture: string;
  shortcut: string;
  action: string;
}) {
  return (
    <View style={styles.shortcutRow}>
      <Text style={styles.shortcutGesture}>{gesture}</Text>
      <Text style={styles.shortcutKey}>{shortcut}</Text>
      <Text style={styles.shortcutAction}>{action}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  content: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  label: { color: '#8e8e93' },
  value: { color: '#fff', fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  hint: { color: '#8e8e93', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  hintSmall: { color: '#6b6b70', fontSize: 12, lineHeight: 16, marginTop: 6 },
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
  presetSelected: { backgroundColor: '#0a84ff' },
  presetText: { color: '#d1d1d6', fontSize: 14, fontWeight: '600' },
  presetTextSelected: { color: '#fff' },
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
  toggleLabels: { flex: 1 },
  toggleTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  shortcutGesture: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  shortcutKey: {
    color: '#0a84ff',
    fontSize: 15,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'center',
  },
  shortcutAction: {
    color: '#8e8e93',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  disconnect: {
    marginTop: 4,
    padding: 14,
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    alignItems: 'center',
  },
  disconnectText: { color: '#ff453a', fontSize: 15, fontWeight: '600' },
});
