import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useServerStore } from '../server-state';
import { fonts, tokens } from '../theme';
import { QRCode } from './atoms/QRCode';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function PairingSheet({ visible, onClose }: Props) {
  const pairing = useServerStore((s) => s.pairing);
  const port = useServerStore((s) => s.port);
  const startPairing = useServerStore((s) => s.startPairing);
  const stopPairing = useServerStore((s) => s.stopPairing);

  useEffect(() => {
    if (visible && !pairing) {
      void startPairing();
    }
  }, [visible, pairing, startPairing]);

  if (!visible) return null;

  const qrPayload = pairing
    ? `entangle://pair?port=${port ?? 0}&token=${pairing.token}`
    : 'entangle://pair';

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Pressable style={styles.dismissCatcher} onPress={onClose} />
      <View style={styles.backdrop} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.qrColumn}>
            <QRCode value={qrPayload} size={188} />
            <ExpiresPill expiresAt={pairing?.expiresAt ?? null} />
          </View>
          <View style={styles.copyColumn}>
            <Text style={styles.eyebrow}>Pair a new phone</Text>
            <Text style={styles.heading}>Scan this code with the{'\n'}Entangle iPhone app.</Text>
            <Text style={styles.lede}>
              One-time code. Both devices stay on this network. Nothing leaves your Wi-Fi.
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>or enter code</Text>
              <Text style={styles.codeValue}>{pairing?.code ?? '— · — · —'}</Text>
            </View>
            <Listening port={port} />
            <View style={styles.actions}>
              <Pressable
                style={styles.primary}
                onPress={() => {
                  void stopPairing();
                  onClose();
                }}>
                <Text style={styles.primaryLabel}>Done</Text>
              </Pressable>
              <Pressable
                style={styles.ghost}
                onPress={() => {
                  void startPairing();
                }}>
                <Text style={styles.ghostLabel}>Regenerate code</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function ExpiresPill({ expiresAt }: { expiresAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) return null;
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <View style={styles.expires}>
      <Text style={styles.expiresText}>
        expires in {m}:{s.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

function Listening({ port }: { port: number | null }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={styles.listening}>
      <Animated.View
        style={[
          styles.listeningDot,
          { opacity, shadowColor: tokens.accent },
        ]}
      />
      <Text style={styles.listeningText}>
        Listening for new device on port{' '}
        <Text style={styles.listeningPort}>:{port ?? '—'}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  dismissCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,12,16,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sheet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
    width: '100%',
    maxWidth: 760,
    paddingVertical: 30,
    paddingHorizontal: 36,
    backgroundColor: 'rgba(20,23,29,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
  },
  qrColumn: {
    alignItems: 'center',
  },
  copyColumn: {
    flex: 1,
  },
  expires: {
    marginTop: -10,
    backgroundColor: '#0a0c10',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  expiresText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: tokens.textMid,
    letterSpacing: 0.6,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: tokens.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  heading: {
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    fontSize: 28,
    letterSpacing: -0.7,
    color: tokens.text,
    lineHeight: 30,
    marginBottom: 12,
  },
  lede: {
    fontSize: 13.5,
    lineHeight: 21,
    color: tokens.textMid,
    marginBottom: 18,
    maxWidth: 380,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    marginBottom: 18,
    alignSelf: 'flex-start',
  },
  codeLabel: {
    fontSize: 11,
    color: tokens.textDim,
  },
  codeValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 3.2,
  },
  listening: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.accent,
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  listeningText: {
    fontSize: 12.5,
    color: tokens.textMid,
  },
  listeningPort: {
    fontFamily: fonts.mono,
    color: tokens.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  primary: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: '#fff',
  },
  primaryLabel: {
    color: '#0e1014',
    fontWeight: '500',
    fontSize: 13,
  },
  ghost: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ghostLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
});
