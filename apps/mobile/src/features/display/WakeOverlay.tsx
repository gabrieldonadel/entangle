import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { PROTOCOL_VERSION } from "@entangle/protocol";

import { C, F } from "@/features/onboarding/atoms";
import { sendMessage } from "@/net/send";
import { useDisplay } from "@/state/display";

/**
 * Covers the trackpad while the Mac's screen is asleep.
 *
 * A pointer move sent to a sleeping display goes nowhere, so the surface would
 * feel broken. Taking the whole surface means any tap the user makes out of
 * habit wakes the Mac instead of being swallowed.
 */
export function WakeOverlay() {
  const waking = useDisplay((s) => s.waking);

  const wake = useCallback(() => {
    if (useDisplay.getState().waking) return;
    useDisplay.getState().markWaking();
    if (Platform.OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    sendMessage({ v: PROTOCOL_VERSION, t: "sys.wake" });
  }, []);

  return (
    <Pressable
      style={styles.root}
      onPress={wake}
      accessibilityRole="button"
      accessibilityLabel="Wake the Mac's screen"
      accessibilityState={{ busy: waking }}
    >
      <View style={styles.badge}>
        <MoonIcon />
      </View>
      <Text style={styles.title}>
        {waking ? "Waking your Mac…" : "Screen is asleep"}
      </Text>
      <Text style={styles.hint}>
        {waking ? "Hold on a second." : "Tap anywhere to wake it."}
      </Text>
    </Pressable>
  );
}

function MoonIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"
        stroke={C.accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={17.5} cy={5.5} r={1} fill={C.accent} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    backgroundColor: "rgba(10, 12, 16, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    color: C.text,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: F.display,
  },
  hint: {
    color: C.muted,
    fontSize: 13,
    textAlign: "center",
  },
});
