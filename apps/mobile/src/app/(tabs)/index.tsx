import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";

import { VolumeBar } from "@/features/audio/VolumeBar";
import { MiniMac } from "@/features/demo/MiniMac";
import { PracticeBanner } from "@/features/demo/PracticeBanner";
import { LockScreen } from "@/features/display/LockScreen";
import { WakeOverlay } from "@/features/display/WakeOverlay";
import { HiddenInput } from "@/features/keyboard/HiddenInput";
import { KEYBOARD_BAR_ID, KeyboardBar } from "@/features/keyboard/KeyboardBar";
import { TrackpadSurface } from "@/features/trackpad/TrackpadSurface";
import type { LocalGestureEvent } from "@/features/trackpad/TrackpadSurface";
import { useConnection } from "@/state/connection";
import { useDisplay } from "@/state/display";
import { useModifiers } from "@/state/modifiers";
import { C } from "@/features/onboarding/atoms";

const CURSOR_W = 14;
const CURSOR_H = 20;

export default function TrackpadScreen() {
  // A short viewport means an iPhone on its side. Keyed on height rather
  // than aspect ratio so a wide browser window keeps the roomy layout.
  const compact = useWindowDimensions().height < 500;
  const serverName = useConnection((s) => s.serverName);
  const phase = useConnection((s) => s.phase);
  const latency = useConnection((s) => s.latencyMs);
  const demo = useConnection((s) => s.demo);
  const serverCaps = useConnection((s) => s.serverCaps);
  const screenAsleep = useDisplay((s) => s.asleep);
  const screenLocked = useDisplay((s) => s.locked);
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

  // Only this route rotates; app.json keeps the rest of the app portrait.
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.unlockAsync().catch(() => {});
      return () => {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {});
      };
    }, []),
  );

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

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.safe, compact && styles.safeCompact]}>
        {demo ? (
          <View
            style={[styles.bannerWrap, compact && styles.bannerWrapCompact]}
          >
            <PracticeBanner />
          </View>
        ) : null}

        <View style={[styles.header, compact && styles.headerCompact]}>
          <View
            style={[styles.headerInfo, compact && styles.headerInfoCompact]}
          >
            {!compact ? (
              <Text style={styles.connected}>
                {demo ? "Practice mode" : "Connected to"}
              </Text>
            ) : null}
            <Text
              style={[styles.serverName, compact && styles.serverNameCompact]}
              numberOfLines={1}
            >
              {serverName ?? "…"}
            </Text>
            <Text style={[styles.meta, compact && styles.metaCompact]}>
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
            {Platform.OS === "ios" ? (
              <Image
                source="sf:keyboard"
                tintColor={focused ? "#fff" : "#d1d1d6"}
                style={styles.kbIcon}
              />
            ) : (
              <KeyboardIcon color={focused ? "#fff" : "#d1d1d6"} size={22} />
            )}
          </Pressable>
        </View>

        {demo ? (
          <View style={styles.miniMacWrap}>
            <MiniMac
              cursor={cursor}
              ripple={ripple}
              onLayoutSize={setMacSize}
            />
          </View>
        ) : null}

        {/* Older Macs ignore `a.*`, so hide the slider rather than let it
            move with no effect. Demo mode has no caps list but drives it
            locally. */}
        {demo || serverCaps.includes("audio") ? <VolumeBar /> : null}

        <View style={styles.padWrap}>
          <TrackpadSurface
            onLocalGesture={demo ? handleLocalGesture : undefined}
          />
          {/* A sleeping screen swallows pointer moves, so cover the pad with a
              tap-to-wake surface instead. Macs without the `wake` cap never
              report their display state. */}
          {!demo && screenAsleep && serverCaps.includes("wake") ? (
            <WakeOverlay />
          ) : null}
        </View>

        <HiddenInput
          ref={inputRef}
          onFocusChange={setFocused}
          inputAccessoryViewID={
            Platform.OS === "ios" ? KEYBOARD_BAR_ID : undefined
          }
        />
      </SafeAreaView>

      {/* Outside the SafeAreaView so the Android bar can be positioned
          against the window's bottom edge rather than the inset content
          box. */}
      <KeyboardBar visible={focused} />

      {/* A sleeping Mac has to be woken before anything can be typed at it, so
          the wake overlay gets the first turn and this takes over once the
          screen is lit and still locked. */}
      {!demo && screenLocked && !screenAsleep && serverCaps.includes("lock") ? (
        <LockScreen />
      ) : null}
    </View>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function KeyboardIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={2}
        y={6}
        width={20}
        height={12}
        rx={2}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  safe: {
    flex: 1,
    padding: 16,
  },
  safeCompact: {
    paddingVertical: 8,
  },
  header: {
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCompact: {
    paddingVertical: 2,
  },
  headerInfo: {
    flexShrink: 1,
  },
  headerInfoCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  serverNameCompact: {
    fontSize: 18,
  },
  meta: {
    color: "#8e8e93",
    fontSize: 12,
    marginTop: 4,
  },
  metaCompact: {
    marginTop: 2,
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
  bannerWrap: {
    marginHorizontal: -16,
    marginTop: -8,
    marginBottom: 4,
  },
  bannerWrapCompact: {
    marginTop: -4,
  },
  miniMacWrap: {
    marginBottom: 12,
  },
  padWrap: {
    flex: 1,
  },
});
