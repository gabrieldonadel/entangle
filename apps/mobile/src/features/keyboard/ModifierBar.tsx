import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ModFlags } from '@entangle/protocol';
import type { ModMask } from '@entangle/protocol';

import { useModifiers } from '@/state/modifiers';

const MODIFIERS: { label: string; bit: ModMask }[] = [
  { label: '⌘', bit: ModFlags.Command },
  { label: '⌥', bit: ModFlags.Option },
  { label: '⇧', bit: ModFlags.Shift },
  { label: '⌃', bit: ModFlags.Control },
];

export function ModifierBar() {
  const mask = useModifiers((s) => s.mask);
  const toggle = useModifiers((s) => s.toggle);

  return (
    <View style={styles.row}>
      {MODIFIERS.map((mod) => {
        const active = (mask & mod.bit) !== 0;
        return (
          <Pressable
            key={mod.label}
            style={[styles.key, active && styles.keyActive]}
            onPress={() => toggle(mod.bit)}>
            <Text style={[styles.keyText, active && styles.keyTextActive]}>{mod.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
  },
  keyActive: {
    backgroundColor: '#0a84ff',
  },
  keyText: {
    color: '#d1d1d6',
    fontSize: 18,
    fontWeight: '600',
  },
  keyTextActive: {
    color: '#fff',
  },
});
