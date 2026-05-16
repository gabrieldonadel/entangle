import { Image } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MiniMac } from "@/features/demo/MiniMac";
import { PracticeBanner } from "@/features/demo/PracticeBanner";
import { HiddenInput } from "@/features/keyboard/HiddenInput";
import { ModifierBar } from "@/features/keyboard/ModifierBar";
import { SpecialKeys } from "@/features/keyboard/SpecialKeys";
import { TrackpadSurface } from "@/features/trackpad/TrackpadSurface";
import type { LocalGestureEvent } from "@/features/trackpad/TrackpadSurface";
import { useConnection } from "@/state/connection";
import { useModifiers } from "@/state/modifiers";
import { C } from "@/features/onboarding/atoms";

const KEYBOARD_BAR_ID = "entangle.keyboardBar";
const CURSOR_W = 14;
const CURSOR_H = 20;

export default function TrackpadScreen() {
  const serverName = useConnection((s) => s.serverName);
  const phase = useConnection((s) => s.phase);
  const latency = useConnection((s) => s.latencyMs);
  const demo = useConnection((s) => s.demo);
  const clearModifiers = useModifiers((s) => s.clear);

  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const [macSize, setMacSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [cursor, setCursor] = useState({ x: 60, y: 50 });
  const [ripple, setRipple] = useState<{
    key: number;
    x: number;
    y: number;
  } | null>(null);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const macSizeRef = useRef(macSize);
  macSizeRef.current = macSize;

  useEffect(() => {
    return () => {
      clearModifiers();
    };
  }, [clearModifiers]);

  // Recenter the cursor when the mini-mac is first measured.
  useEffect(() => {
    if (macSize.width > 0 && macSize.height > 0) {
      setCursor((prev) =>
        prev.x === 60 && prev.y === 50
          ? { x: macSize.width * 0.45, y: macSize.height * 0.55 }
          : prev,
      );
    }
  }, [macSize.width, macSize.height]);

  const handleLocalGesture = useCallback((event: LocalGestureEvent) => {
    const size = macSizeRef.current;
    if (size.width <= 0) return;
    const scaleFactor = 0.45;
    if (event.type === "move") {
      setCursor((prev) => ({
        x: clamp(prev.x + event.dx * scaleFactor, 0, size.width - CURSOR_W),
        y: clamp(prev.y + event.dy * scaleFactor, 0, size.height - CURSOR_H),
      }));
    } else if (event.type === "scroll") {
      setCursor((prev) => ({
        x: prev.x,
        y: clamp(prev.y + event.dy * 0.35, 0, size.height - CURSOR_H),
      }));
    } else if (event.type === "tap" || event.type === "rightClick") {
      const c = cursorRef.current;
      setRipple({ key: Date.now(), x: c.x + 4, y: c.y + 8 });
      setTimeout(() => setRipple(null), 500);
    }
  }, []);

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
      {demo ? (
        <View style={styles.bannerWrap}>
          <PracticeBanner />
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.connected}>
            {demo ? "Practice mode" : "Connected to"}
          </Text>
          <Text style={styles.serverName} numberOfLines={1}>
            {serverName ?? "…"}
          </Text>
          <Text style={styles.meta}>
            {demo
              ? "not a real connection"
              : `${phase}${latency != null ? ` · ${latency}ms` : ""}`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={focused ? "Hide keyboard" : "Show keyboard"}
          style={[styles.kbButton, focused && styles.kbButtonActive]}
          onPress={toggleKeyboard}
        >
          <Image
            source="sf:keyboard"
            tintColor={focused ? "#fff" : "#d1d1d6"}
            style={styles.kbIcon}
          />
        </Pressable>
      </View>

      {demo ? (
        <View style={styles.miniMacWrap}>
          <MiniMac cursor={cursor} ripple={ripple} onLayoutSize={setMacSize} />
        </View>
      ) : null}

      <TrackpadSurface onLocalGesture={demo ? handleLocalGesture : undefined} />

      <HiddenInput
        ref={inputRef}
        onFocusChange={setFocused}
        inputAccessoryViewID={
          Platform.OS === "ios" ? KEYBOARD_BAR_ID : undefined
        }
      />

      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={KEYBOARD_BAR_ID}>
          {accessoryBar}
        </InputAccessoryView>
      ) : null}
    </SafeAreaView>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    padding: 16,
  },
  header: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerInfo: {
    flexShrink: 1,
  },
  connected: {
    color: "#8e8e93",
    fontSize: 13,
  },
  serverName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  meta: {
    color: "#8e8e93",
    fontSize: 12,
    marginTop: 4,
  },
  kbButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1c1c1e",
    alignItems: "center",
    justifyContent: "center",
  },
  kbButtonActive: {
    backgroundColor: "#0a84ff",
  },
  kbIcon: {
    width: 22,
    height: 22,
  },
  bar: {
    padding: 12,
    gap: 8,
    backgroundColor: "#0a0a0b",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2c2c2e",
  },
  specialKeys: {
    marginHorizontal: -4,
  },
  bannerWrap: {
    marginHorizontal: -16,
    marginTop: -8,
    marginBottom: 4,
  },
  miniMacWrap: {
    marginBottom: 12,
  },
});
