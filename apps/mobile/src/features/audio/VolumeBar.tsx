import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Path } from "react-native-svg";

import { PROTOCOL_VERSION } from "@entangle/protocol";

import { C, F } from "@/features/onboarding/atoms";
import { sendMessage } from "@/net/send";
import { useAudio } from "@/state/audio";
import { useConnection } from "@/state/connection";

/** Minimum gap between `a.set` messages while dragging. */
const SEND_INTERVAL_MS = 40;

export function VolumeBar() {
  const level = useAudio((s) => s.level);
  const muted = useAudio((s) => s.muted);
  const demo = useConnection((s) => s.demo);

  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  trackWidthRef.current = trackWidth;

  const lastSentAt = useRef(0);
  const lastSentLevel = useRef<number | null>(null);

  const push = useCallback(
    (next: number, force: boolean) => {
      const now = Date.now();
      if (!force && now - lastSentAt.current < SEND_INTERVAL_MS) return;
      if (!force && lastSentLevel.current === next) return;
      lastSentAt.current = now;
      lastSentLevel.current = next;
      // Demo mode moves the local slider only — there is no Mac to talk to.
      if (demo) return;
      sendMessage({ v: PROTOCOL_VERSION, t: "a.set", level: next });
    },
    [demo],
  );

  const applyFromX = useCallback(
    (x: number, force: boolean) => {
      const width = trackWidthRef.current;
      if (width <= 0) return;
      const next = Math.min(1, Math.max(0, x / width));
      useAudio.getState().setLocalLevel(next);
      push(next, force);
    },
    [push],
  );

  const pan = useRef(
    Gesture.Pan()
      .minDistance(0)
      .onBegin((event) => {
        useAudio.getState().setDragging(true);
        applyFromX(event.x, true);
      })
      .onUpdate((event) => {
        applyFromX(event.x, false);
      })
      .onEnd((event) => {
        applyFromX(event.x, true);
        useAudio.getState().setDragging(false);
      })
      .onFinalize(() => {
        useAudio.getState().setDragging(false);
      })
      .runOnJS(true),
  ).current;

  const toggleMute = useCallback(() => {
    const next = !useAudio.getState().muted;
    useAudio.setState({ muted: next });
    if (Platform.OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (demo) return;
    sendMessage({ v: PROTOCOL_VERSION, t: "a.mute", muted: next });
  }, [demo]);

  const percent = Math.round(level * 100);
  const filledWidth = muted ? 0 : Math.max(0, Math.min(1, level)) * trackWidth;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggleMute}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={muted ? "Unmute the Mac" : "Mute the Mac"}
        style={styles.iconButton}
      >
        <SpeakerIcon muted={muted} />
      </Pressable>

      <GestureDetector gesture={pan}>
        <View
          style={styles.trackArea}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel="Mac volume"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: filledWidth }]} />
          </View>
          <View
            style={[
              styles.knob,
              { transform: [{ translateX: filledWidth - KNOB / 2 }] },
              muted && styles.knobMuted,
            ]}
          />
        </View>
      </GestureDetector>

      <Text style={styles.value}>{muted ? "—" : `${percent}`}</Text>
    </View>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M4 9h3l4.5-3.5v13L7 15H4z"
        stroke={muted ? C.dim : C.accent}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {muted ? (
        <Path
          d="M16 9.5l4 5M20 9.5l-4 5"
          stroke={C.dim}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <Path
          d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
          stroke={C.accent}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
      )}
    </Svg>
  );
}

const KNOB = 16;
const TRACK_HEIGHT = 4;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
  },
  iconButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  trackArea: {
    flex: 1,
    height: 30,
    justifyContent: "center",
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "rgba(163,187,214,0.16)",
    overflow: "hidden",
  },
  trackFill: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: C.accent,
  },
  knob: {
    position: "absolute",
    left: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: C.text,
  },
  knobMuted: {
    backgroundColor: C.dim,
  },
  value: {
    minWidth: 30,
    textAlign: "right",
    color: C.muted,
    fontSize: 12,
    fontFamily: F.mono,
  },
});
