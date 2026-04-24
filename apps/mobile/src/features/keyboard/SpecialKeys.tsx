import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { PROTOCOL_VERSION } from '@entangle/protocol';
import type { KeyCode } from '@entangle/protocol';

import { sendMessage } from '@/net/send';
import { useModifiers } from '@/state/modifiers';

const SPECIAL_KEYS: { label: string; code: KeyCode; wide?: boolean }[] = [
  { label: 'esc', code: 'Escape' },
  { label: 'tab', code: 'Tab' },
  { label: '⏎', code: 'Return' },
  { label: '⌫', code: 'Backspace' },
  { label: 'space', code: 'Space', wide: true },
  { label: '←', code: 'ArrowLeft' },
  { label: '↓', code: 'ArrowDown' },
  { label: '↑', code: 'ArrowUp' },
  { label: '→', code: 'ArrowRight' },
  { label: 'home', code: 'Home' },
  { label: 'end', code: 'End' },
  { label: 'pgUp', code: 'PageUp' },
  { label: 'pgDn', code: 'PageDown' },
  { label: 'del', code: 'Delete' },
];

export function SpecialKeys() {
  const consumeMods = useModifiers((s) => s.consume);

  const handlePress = (code: KeyCode) => {
    const mods = consumeMods();
    sendMessage({ v: PROTOCOL_VERSION, t: 'k.key', code, phase: 'tap', mods });
    void Haptics.selectionAsync();
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {SPECIAL_KEYS.map((key) => (
        <Pressable
          key={key.code}
          onPress={() => handlePress(key.code)}
          style={[styles.key, key.wide && styles.keyWide]}>
          <Text style={styles.keyText}>{key.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  key: {
    minWidth: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: {
    minWidth: 120,
  },
  keyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
