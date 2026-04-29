import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useShallow } from 'zustand/react/shallow';

import type { ClientInfo } from '../server-state';
import { useServerStore } from '../server-state';
import { fonts, tokens } from '../theme';
import { EntCard } from './atoms/EntCard';
import { Heading } from './atoms/Heading';
import { MiniPhone } from './atoms/MiniPhone';
import { EmptyPhones } from './EmptyPhones';

type Props = {
  onPairNew?: () => void;
};

export function ConnectedPhones({ onPairNew }: Props) {
  const clients = useServerStore(useShallow((s) => Object.values(s.clients)));

  if (clients.length === 0) {
    return <EmptyPhones onShowPairing={onPairNew} />;
  }

  return (
    <EntCard style={styles.card}>
      <Heading
        title="Connected phones"
        count={clients.length}
        sub="auto-trusted on first pair"
        density="compact"
      />
      <View>
        {clients.map((c, i) => (
          <DeviceRow key={c.id} client={c} last={i === clients.length - 1} />
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Devices remembered for 30 days. Forget all to re-pair.
        </Text>
        {onPairNew ? (
          <Pressable onPress={onPairNew} style={styles.pairButton}>
            <Text style={styles.pairLabel}>+ Pair new</Text>
          </Pressable>
        ) : null}
      </View>
    </EntCard>
  );
}

function DeviceRow({ client, last }: { client: ClientInfo; last: boolean }) {
  return (
    <View style={[styles.deviceRow, !last && styles.deviceBorder]}>
      <MiniPhone size={28} />
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>
          {client.host || 'unknown phone'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {`id ${client.id.slice(0, 8)} · ${
            client.host?.includes('.') ? client.host : 'on this network'
          }`}
        </Text>
      </View>
      <Stat label="latency" value="—" />
      <Stat label="events" value={`${client.messageRate}/s`} />
      <Pressable style={styles.kebab} accessibilityLabel="More actions for this device">
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Circle cx={5} cy={12} r={2} fill={tokens.textMuted} />
          <Circle cx={12} cy={12} r={2} fill={tokens.textMuted} />
          <Circle cx={19} cy={12} r={2} fill={tokens.textMuted} />
        </Svg>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  deviceBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13.5,
    fontWeight: '500',
    color: tokens.text,
  },
  meta: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 1,
    fontFamily: fonts.mono,
  },
  stat: {
    alignItems: 'flex-end',
    minWidth: 64,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: tokens.textMuted,
  },
  kebab: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  footerText: {
    fontSize: 11.5,
    color: tokens.textDim,
    flex: 1,
  },
  pairButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(163,187,214,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(163,187,214,0.18)',
  },
  pairLabel: {
    fontSize: 11.5,
    color: tokens.accent,
  },
});
