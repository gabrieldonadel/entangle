import { PROTOCOL_VERSION } from '@entangle/protocol';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatUptime, useServerStore } from '../server-state';
import { fonts, tokens } from '../theme';
import { EntCard } from './atoms/EntCard';
import { Heading } from './atoms/Heading';
import { Row } from './atoms/Row';
import { Sparkline } from './atoms/Sparkline';
import { StatusPill } from './atoms/StatusPill';

export function ServerCard() {
  const phase = useServerStore((s) => s.phase);
  const port = useServerStore((s) => s.port);
  const serviceName = useServerStore((s) => s.serviceName);
  const messageRate = useServerStore((s) => s.messageRate);
  const rateHistory = useServerStore((s) => s.rateHistory);
  const uptimeSeconds = useServerStore((s) => s.uptimeSeconds);
  const lastError = useServerStore((s) => s.lastError);

  const tone = phase === 'running' ? 'ok' : phase === 'starting' ? 'info' : phase === 'error' ? 'warn' : 'idle';

  return (
    <EntCard style={styles.card}>
      <Heading title="Server" sub="LAN-only · Bonjour" density="compact" />
      <View style={styles.body}>
        <Row
          density="compact"
          k="Status"
          v={<StatusPill tone={tone}>{phase}</StatusPill>}
        />
        <Row density="compact" k="Service" v={serviceName ?? '—'} />
        <Row density="compact" k="Port" v={port != null ? String(port) : '—'} mono />
        <Row density="compact" k="Protocol" v={`entangle/v${PROTOCOL_VERSION}`} mono />
        <Row
          density="compact"
          k="Msgs/sec"
          v={
            <View style={styles.rateValue}>
              <Sparkline data={rateHistory} width={88} height={20} />
              <Text style={styles.rateNumber}>{messageRate}</Text>
            </View>
          }
        />
        <Row density="compact" k="Uptime" v={formatUptime(uptimeSeconds)} mono />
      </View>
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}
    </EntCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  body: {
    paddingVertical: 6,
  },
  rateValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rateNumber: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: tokens.textHigh,
    minWidth: 22,
    textAlign: 'right',
  },
  error: {
    color: tokens.danger,
    fontSize: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.divider,
  },
});
