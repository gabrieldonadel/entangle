import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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

import { DemoAppIcon } from '@/features/demo/DemoAppIcon';
import { F } from '@/features/onboarding/atoms';
import { sendMessage } from '@/net/send';
import { useConnection } from '@/state/connection';
import { getDemoIconBg, getDemoIconKind } from '@/state/demo';
import { useDock } from '@/state/dock';

export function DockGrid() {
  const apps = useDock(useShallow((s) => s.apps));
  const phase = useConnection((s) => s.phase);
  const demo = useConnection((s) => s.demo);

  useEffect(() => {
    if (phase !== 'open' || demo) return;
    sendMessage({ v: PROTOCOL_VERSION, t: 'd.list' });
  }, [phase, demo]);

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
      renderItem={({ item }) => <DockItem app={item} demo={demo} />}
    />
  );
}

function DockItem({ app, demo }: { app: DockApp; demo: boolean }) {
  const [activated, setActivated] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const demoKind = demo ? getDemoIconKind(app.bundleId) : null;
  const demoBg = demo ? getDemoIconBg(app.bundleId) ?? '#1c1c1e' : null;

  const onPress = () => {
    sendMessage({ v: PROTOCOL_VERSION, t: 'd.activate', bundleId: app.bundleId });
    void Haptics.selectionAsync();
    if (demo) {
      setActivated(true);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => setActivated(false), 480);
    }
  };

  return (
    <Pressable style={styles.cell} onPress={onPress}>
      <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
        {demoKind && demoBg ? (
          <DemoAppIcon kind={demoKind} bg={demoBg} size={CELL_SIZE} />
        ) : app.iconPng ? (
          <Image
            source={{ uri: `data:image/png;base64,${app.iconPng}` }}
            style={styles.icon}
          />
        ) : (
          <View style={styles.iconFallback} />
        )}
        {app.running ? <View style={styles.runningDot} /> : null}
      </Animated.View>
      <Text style={styles.name} numberOfLines={1}>
        {app.name}
      </Text>
      {activated ? (
        <View style={styles.activatedPill}>
          <Text style={styles.activatedText}>Activated</Text>
        </View>
      ) : null}
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
  activatedPill: {
    position: 'absolute',
    top: -6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#56a0ff',
    borderRadius: 999,
  },
  activatedText: {
    color: '#0a0c10',
    fontFamily: F.mono,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
