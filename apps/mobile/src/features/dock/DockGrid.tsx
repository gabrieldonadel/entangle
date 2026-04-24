import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { PROTOCOL_VERSION } from '@entangle/protocol';
import type { DockApp } from '@entangle/protocol';

import { sendMessage } from '@/net/send';
import { useConnection } from '@/state/connection';
import { useDock } from '@/state/dock';

export function DockGrid() {
  const apps = useDock(useShallow((s) => s.apps));
  const phase = useConnection((s) => s.phase);

  useEffect(() => {
    if (phase !== 'open') return;
    sendMessage({ v: PROTOCOL_VERSION, t: 'd.list' });
  }, [phase]);

  if (apps.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {phase === 'open' ? 'Loading dock…' : 'Not connected'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={apps}
      keyExtractor={(app) => app.bundleId}
      numColumns={4}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => <DockItem app={item} />}
    />
  );
}

function DockItem({ app }: { app: DockApp }) {
  const onPress = () => {
    sendMessage({ v: PROTOCOL_VERSION, t: 'd.activate', bundleId: app.bundleId });
    void Haptics.selectionAsync();
  };
  return (
    <Pressable style={styles.cell} onPress={onPress}>
      <View style={styles.iconWrap}>
        {app.iconPng ? (
          <Image
            source={{ uri: `data:image/png;base64,${app.iconPng}` }}
            style={styles.icon}
          />
        ) : (
          <View style={styles.iconFallback} />
        )}
        {app.running ? <View style={styles.runningDot} /> : null}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {app.name}
      </Text>
    </Pressable>
  );
}

const CELL_SIZE = 72;

const styles = StyleSheet.create({
  grid: {
    padding: 12,
    gap: 12,
  },
  row: {
    gap: 8,
    marginBottom: 12,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 16,
  },
  iconFallback: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 16,
    backgroundColor: '#2c2c2e',
  },
  runningDot: {
    position: 'absolute',
    bottom: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0a84ff',
  },
  name: {
    color: '#fff',
    fontSize: 11,
    maxWidth: CELL_SIZE,
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#8e8e93',
  },
});
