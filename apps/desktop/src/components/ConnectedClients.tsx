import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useServerStore } from '../server-state';

export function ConnectedClients() {
  const clients = useServerStore(useShallow((s) => Object.values(s.clients)));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Connected phones ({clients.length})</Text>
      {clients.length === 0 ? (
        <Text style={styles.empty}>No phones connected.</Text>
      ) : (
        clients.map((client) => (
          <View key={client.id} style={styles.row}>
            <Text style={styles.host} numberOfLines={1}>
              {client.host}
            </Text>
            <Text style={styles.stat}>
              {client.messageCount} msg · {relativeTime(client.lastMessageAt)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function relativeTime(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 1) return 'now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  empty: {
    color: '#8e8e93',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopColor: '#2c2c2e',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  host: {
    color: '#fff',
    flexShrink: 1,
    marginRight: 12,
  },
  stat: {
    color: '#8e8e93',
    fontVariant: ['tabular-nums'],
  },
});
