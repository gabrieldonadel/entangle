import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import { HiddenInput } from '@/features/keyboard/HiddenInput';
import { ModifierBar } from '@/features/keyboard/ModifierBar';
import { SpecialKeys } from '@/features/keyboard/SpecialKeys';
import { useModifiers } from '@/state/modifiers';

export default function KeyboardScreen() {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const clearModifiers = useModifiers((s) => s.clear);

  useEffect(() => {
    return () => {
      clearModifiers();
    };
  }, [clearModifiers]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={{ top: true, bottom: true }} style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.body}>
            <Text style={styles.title}>Keyboard</Text>
            <Text style={styles.subtitle}>
              Keystrokes forward to your Mac. Modifiers are one-shot: they apply to the next
              special key and then clear.
            </Text>
            <Pressable
              style={[styles.focusButton, focused && styles.focusButtonActive]}
              onPress={focusInput}>
              <Text style={styles.focusButtonText}>
                {focused ? 'Typing active — tap to stay focused' : 'Tap to start typing'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.bar}>
            <ModifierBar />
            <View style={styles.specialKeys}>
              <SpecialKeys />
            </View>
          </View>

          <HiddenInput ref={inputRef} onFocusChange={setFocused} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  subtitle: {
    color: '#8e8e93',
    fontSize: 14,
    lineHeight: 20,
  },
  focusButton: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
  },
  focusButtonActive: {
    backgroundColor: '#0a84ff',
  },
  focusButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
