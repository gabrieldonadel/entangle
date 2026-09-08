import { useCallback } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { PROTOCOL_VERSION } from '@entangle/protocol';

import { sendMessage } from '@/net/send';
import { useDiag } from '@/state/diag';

/**
 * Live numbers for the pointer path, off by default.
 *
 * The split matters when reading these: the phone can only honestly measure
 * what it does itself — how often it sends, and the round trip — while
 * everything under "Mac" is measured on the Mac's own clock. Nothing here
 * compares the two clocks, so none of it depends on them agreeing.
 */
export function DiagnosticsCard() {
  const enabled = useDiag((s) => s.enabled);
  const sendRate = useDiag((s) => s.sendRate);
  const rttP50 = useDiag((s) => s.rttP50);
  const rttP95 = useDiag((s) => s.rttP95);
  const mac = useDiag((s) => s.mac);

  const toggle = useCallback((on: boolean) => {
    useDiag.getState().setEnabled(on);
    sendMessage({ v: PROTOCOL_VERSION, t: 'diag.set', on });
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.toggleRow}>
        <View style={styles.toggleLabels}>
          <Text style={styles.toggleTitle}>Pointer diagnostics</Text>
          <Text style={styles.toggleSubtitle}>
            Measures the cursor path while you swipe. Adds a timestamp to every pointer
            frame, so leave it off for everyday use.
          </Text>
        </View>
        <Switch value={enabled} onValueChange={toggle} />
      </View>

      {enabled ? (
        <View style={styles.readout}>
          <Text style={styles.group}>Phone</Text>
          <Stat label="Sent" value={`${sendRate}/s`} />
          <Stat label="Round trip" value={`${ms(rttP50)} p50 · ${ms(rttP95)} p95`} />

          <Text style={styles.group}>Mac</Text>
          {mac ? (
            <>
              <Stat label="Applied" value={`${mac.rate}/s`} />
              <Stat
                label="Arrival gap"
                value={`${ms(mac.gapP50)} p50 · ${ms(mac.gapP95)} p95`}
              />
              <Stat label="Jitter" value={ms(mac.jitter)} />
              <Stat
                label="Receive → post"
                value={`${ms(mac.procP50)} p50 · ${ms(mac.procP95)} p95`}
              />
              <Stat label="Stalls over 50 ms" value={`${mac.stalls}`} />
            </>
          ) : (
            <Text style={styles.waiting}>Waiting for the first second…</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ms(value: number): string {
  return `${value.toFixed(value < 10 ? 1 : 0)} ms`;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  toggleLabels: { flex: 1 },
  toggleTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  readout: { marginTop: 12 },
  group: {
    color: '#6b6b70',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    gap: 12,
  },
  label: { color: '#8e8e93', fontSize: 13 },
  value: {
    color: '#fff',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  waiting: { color: '#6b6b70', fontSize: 13, paddingVertical: 5 },
});
