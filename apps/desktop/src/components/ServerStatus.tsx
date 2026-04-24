import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useServerStore } from '../server-state';

export function ServerStatus() {
  const phase = useServerStore((s) => s.phase);
  const port = useServerStore((s) => s.port);
  const serviceName = useServerStore((s) => s.serviceName);
  const messageRate = useServerStore((s) => s.messageRate);
  const lastError = useServerStore((s) => s.lastError);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Server</Text>
      <Row label="Status" value={phase} />
      <Row label="Service" value={serviceName ?? '—'} />
      <Row label="Port" value={port != null ? String(port) : '—'} />
      <Row label="Msgs/sec" value={String(messageRate)} />
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
    </View>
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
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: { color: '#8e8e93' },
  value: { color: '#fff', fontVariant: ['tabular-nums'] },
  error: { color: '#ff453a', marginTop: 8 },
});
