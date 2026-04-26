import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HiddenInput } from '@/features/keyboard/HiddenInput';
import { ModifierBar } from '@/features/keyboard/ModifierBar';
import { SpecialKeys } from '@/features/keyboard/SpecialKeys';
import { TrackpadSurface } from '@/features/trackpad/TrackpadSurface';
import { useConnection } from '@/state/connection';
import { useModifiers } from '@/state/modifiers';

const KEYBOARD_BAR_ID = 'entangle.keyboardBar';

export default function TrackpadScreen() {
  const serverName = useConnection((s) => s.serverName);
  const phase = useConnection((s) => s.phase);
  const latency = useConnection((s) => s.latencyMs);
  const clearModifiers = useModifiers((s) => s.clear);

  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    return () => {
      clearModifiers();
    };
  }, [clearModifiers]);

  const toggleKeyboard = () => {
    if (focused) {
      Keyboard.dismiss();
    } else {
      inputRef.current?.focus();
    }
  };

  const accessoryBar = (
    <View style={styles.bar}>
      <ModifierBar />
      <View style={styles.specialKeys}>
        <SpecialKeys />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.connected}>Connected to</Text>
          <Text style={styles.serverName} numberOfLines={1}>
            {serverName ?? '…'}
          </Text>
          <Text style={styles.meta}>
            {phase}
            {latency != null ? ` · ${latency}ms` : ''}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={focused ? 'Hide keyboard' : 'Show keyboard'}
          style={[styles.kbButton, focused && styles.kbButtonActive]}
          onPress={toggleKeyboard}>
          <Image
            source="sf:keyboard"
            tintColor={focused ? '#fff' : '#d1d1d6'}
            style={styles.kbIcon}
          />
        </Pressable>
      </View>

      <TrackpadSurface />

      <HiddenInput
        ref={inputRef}
        onFocusChange={setFocused}
        inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_BAR_ID : undefined}
      />

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={KEYBOARD_BAR_ID}>{accessoryBar}</InputAccessoryView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    padding: 16,
  },
  header: {
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerInfo: {
    flexShrink: 1,
  },
  connected: {
    color: '#8e8e93',
    fontSize: 13,
  },
  serverName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  meta: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
  },
  kbButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kbButtonActive: {
    backgroundColor: '#0a84ff',
  },
  kbIcon: {
    width: 22,
    height: 22,
  },
  bar: {
    padding: 12,
    gap: 8,
    backgroundColor: '#0a0a0b',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2c2c2e',
  },
  specialKeys: {
    marginHorizontal: -4,
  },
});
