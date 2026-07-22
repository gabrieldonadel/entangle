import { Stack, router } from "@/lib/router";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "@/components/Logo";
import { useConnection } from "@/state/connection";

export default function PairScreen() {
  const params = useLocalSearchParams<{
    host?: string;
    port?: string;
    token?: string;
  }>();
  const phase = useConnection((s) => s.phase);
  const target = useConnection((s) => s.target);
  const pairingError = useConnection((s) => s.pairingError);
  const retryPairing = useConnection((s) => s.retryPairing);
  const connectWithToken = useConnection((s) => s.connectWithToken);
  const disconnect = useConnection((s) => s.disconnect);
  const [code, setCode] = useState("");

  // Universal-link auto-pair: when this screen is opened with `host`, `port`
  // and `token` query params (e.g. iOS Camera scanned the QR code), skip the
  // manual code-entry UI and connect directly. Run only once per param set.
  const dispatchedTokenRef = useRef<string | null>(null);
  useEffect(() => {
    const portNum = params.port ? parseInt(params.port, 10) : NaN;
    if (
      params.host &&
      Number.isFinite(portNum) &&
      params.token &&
      dispatchedTokenRef.current !== params.token
    ) {
      dispatchedTokenRef.current = params.token;
      connectWithToken({
        host: params.host,
        port: portNum,
        token: params.token,
      });
    }
  }, [params.host, params.port, params.token, connectWithToken]);

  const hasDeepLinkParams =
    Boolean(params.host) && Boolean(params.port) && Boolean(params.token);

  useEffect(() => {
    if (phase === "open") {
      router.replace("/(tabs)");
    } else if (phase === "idle" && !hasDeepLinkParams) {
      router.replace("/connect");
    }
  }, [phase, hasDeepLinkParams]);

  const submitting = phase === "connecting" || phase === "reconnecting";

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ title: "Pair", headerShown: false }} />
      {/* behavior="padding" on BOTH platforms: edge-to-edge Android (SDK 54+)
          no longer resizes the window for the keyboard, so KAV must do it. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <Logo size={44} />
          </View>
          <Text style={styles.eyebrow}>PAIRING REQUIRED</Text>
          <Text style={styles.title}>
            {target?.name ?? "This Mac"} needs your permission.
          </Text>
          <Text style={styles.lede}>
            On your Mac, open Entangle and tap{" "}
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
            <Text style={styles.error}>
              Mac rejected the request: {pairingError}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.primary,
                (submitting || !code.trim()) && styles.primaryDisabled,
              ]}
              disabled={submitting || !code.trim()}
              onPress={() => retryPairing(code)}
            >
              <Text style={styles.primaryLabel}>
                {submitting ? "Connecting…" : "Send code"}
              </Text>
            </Pressable>
            <Pressable style={styles.ghost} onPress={() => disconnect()}>
              <Text style={styles.ghostLabel}>Cancel</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  flex: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  brand: {
    marginBottom: 20,
    alignItems: "flex-start",
  },
  eyebrow: {
    color: "#a3bbd6",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.6,
    marginBottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  lede: {
    color: "#8e8e93",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  strong: {
    color: "#fff",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    color: "#8e8e93",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  codeInput: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: 4,
    paddingVertical: 6,
  },
  error: {
    color: "#ff453a",
    fontSize: 13,
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  primary: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryDisabled: {
    opacity: 0.6,
  },
  primaryLabel: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  ghost: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: "#1c1c1e",
    alignItems: "center",
  },
  ghostLabel: {
    color: "#8e8e93",
    fontSize: 16,
  },
});
