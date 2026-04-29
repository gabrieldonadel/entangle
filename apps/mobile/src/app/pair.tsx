import { Stack, router } from '@/lib/router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useConnection } from '@/state/connection';

export default function PairScreen() {
  const phase = useConnection((s) => s.phase);
  const target = useConnection((s) => s.target);
  const pairingError = useConnection((s) => s.pairingError);
  const retryPairing = useConnection((s) => s.retryPairing);
  const disconnect = useConnection((s) => s.disconnect);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (phase === 'open') {
      router.replace('/(tabs)');
    } else if (phase === 'idle') {
      router.replace('/connect');
    }
  }, [phase]);

  const submitting = phase === 'connecting' || phase === 'reconnecting';

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ title: 'Pair', headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Text style={styles.eyebrow}>PAIRING REQUIRED</Text>
          <Text style={styles.title}>
            {target?.name ?? 'This Mac'} needs your permission.
          </Text>
          <Text style={styles.lede}>
            On your Mac, open Entangle and tap{' '}
            <Text style={styles.strong}>Pair new device</Text>. Then enter the
            code shown on the Mac.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>pairing code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="AB · CD · EF"
              placeholderTextColor="#5a5a5e"
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              style={styles.codeInput}
              maxLength={20}
            />
          </View>

          {pairingError ? (
            <Text style={styles.error}>Mac rejected the request: {pairingError}</Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.primary,
                (submitting || !code.trim()) && styles.primaryDisabled,
              ]}
              disabled={submitting || !code.trim()}
              onPress={() => retryPairing(code)}>
              <Text style={styles.primaryLabel}>
                {submitting ? 'Connecting…' : 'Send code'}
              </Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => disconnect()}>
              <Text style={styles.ghostLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  body: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  eyebrow: {
    color: '#a3bbd6',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.6,
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  lede: {
    color: '#8e8e93',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  strong: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    color: '#8e8e93',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  codeInput: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 4,
    paddingVertical: 6,
  },
  error: {
    color: '#ff453a',
    fontSize: 13,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  primary: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  ghost: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
  },
  ghostLabel: {
    color: '#8e8e93',
    fontSize: 16,
  },
});
