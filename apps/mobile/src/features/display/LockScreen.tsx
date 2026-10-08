import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";

import { PROTOCOL_VERSION } from "@entangle/protocol";

import {
  C,
  F,
  GhostLink,
  PrimaryButton,
  Spinner,
} from "@/features/onboarding/atoms";
import { sendMessage } from "@/net/send";
import { useDisplay } from "@/state/display";

/**
 * Covers the app while the Mac sits on its lock screen.
 *
 * Reaching the password field through the trackpad means opening the keyboard
 * by hand and then steering a cursor to Return, which is most of the work of
 * just walking over to the Mac. This offers the field directly: the Mac types
 * what it receives into the lock screen and submits it.
 *
 * The password lives in this component's state and nowhere else — not in a
 * store, not on disk — and is dropped the moment it is sent.
 */
export function LockScreen() {
  const unlocking = useDisplay((s) => s.unlocking);
  const failed = useDisplay((s) => s.unlockFailed);
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const submit = useCallback(() => {
    if (!password || useDisplay.getState().unlocking) return;
    useDisplay.getState().markUnlocking();
    sendMessage({ v: PROTOCOL_VERSION, t: "sys.unlock", password });
    setPassword("");
    setRevealed(false);
    Keyboard.dismiss();
    if (Platform.OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [password]);

  // Letting the user out matters: Touch ID and Apple Watch are often the
  // faster way in, and the trackpad still moves the lock screen's cursor.
  if (dismissed) {
    return (
      <View style={styles.pill} pointerEvents="box-none">
        <Pressable
          style={styles.pillButton}
          onPress={() => setDismissed(false)}
          accessibilityRole="button"
          accessibilityLabel="Show the login screen"
        >
          <LockIcon size={14} />
          <Text style={styles.pillLabel}>Locked · sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.badge}>
          <LockIcon size={24} />
        </View>
        <Text style={styles.eyebrow}>MAC IS LOCKED</Text>
        <Text style={styles.title}>Sign back in.</Text>
        <Text style={styles.lede}>
          Your password goes straight to the Mac&apos;s lock screen. Entangle
          does not keep it.
        </Text>

        <View style={styles.field}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            placeholder="Account password"
            placeholderTextColor={C.dim}
            secureTextEntry={!revealed}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="password"
            autoComplete="password"
            returnKeyType="go"
            keyboardAppearance="dark"
            editable={!unlocking}
            style={styles.input}
          />
          <Pressable
            style={styles.reveal}
            onPress={() => setRevealed((on) => !on)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
          >
            <Text style={styles.revealLabel}>{revealed ? "Hide" : "Show"}</Text>
          </Pressable>
        </View>

        {failed ? (
          <Text style={styles.error}>
            Your Mac is still locked. Check the password and try again.
          </Text>
        ) : null}

        <View style={styles.actions}>
          {unlocking ? (
            <View style={styles.pending}>
              <Spinner size={16} />
              <Text style={styles.pendingLabel}>Signing in…</Text>
            </View>
          ) : (
            <PrimaryButton onPress={submit} disabled={!password}>
              Unlock
            </PrimaryButton>
          )}
          <GhostLink onPress={() => setDismissed(true)}>
            I&apos;ll unlock at the Mac
          </GhostLink>
        </View>
      </SafeAreaView>
    </View>
  );
}

function LockIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={5}
        y={11}
        width={14}
        height={9}
        rx={2}
        stroke={C.accent}
        strokeWidth={1.5}
      />
      <Path
        d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"
        stroke={C.accent}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 10, 14, 0.98)",
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    // Anchored to the top so the soft keyboard, which opens with the field,
    // has nothing to cover.
    paddingTop: 24,
    gap: 10,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  eyebrow: {
    color: C.dim,
    fontSize: 11,
    letterSpacing: 1.6,
    fontFamily: F.mono,
  },
  title: {
    color: C.text,
    fontSize: 26,
    fontWeight: "700",
    fontFamily: F.display,
  },
  lede: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    borderRadius: 12,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: C.text,
    fontSize: 17,
    paddingVertical: 14,
  },
  reveal: {
    paddingLeft: 12,
  },
  revealLabel: {
    color: C.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    color: "#ff9f9f",
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    marginTop: 12,
    gap: 6,
  },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  pendingLabel: {
    color: C.muted,
    fontSize: 15,
  },
  pill: {
    position: "absolute",
    left: 0,
    right: 0,
    // Below the trackpad rather than over the header: dismissing the login
    // screen hands the surface back, and this has to stay out of its way.
    bottom: 24,
    alignItems: "center",
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    backgroundColor: C.bg2,
  },
  pillLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
