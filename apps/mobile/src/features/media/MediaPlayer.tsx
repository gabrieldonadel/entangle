import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Polygon, Rect } from "react-native-svg";

import { PROTOCOL_VERSION } from "@entangle/protocol";
import type { MediaCommand } from "@entangle/protocol";

import { C, F } from "@/features/onboarding/atoms";
import { sendMessage } from "@/net/send";
import { useConnection } from "@/state/connection";
import { hasTrackInfo, useMedia } from "@/state/media";

export function MediaPlayer() {
  const playing = useMedia((s) => s.playing);
  const title = useMedia((s) => s.title);
  const artist = useMedia((s) => s.artist);
  const album = useMedia((s) => s.album);
  const app = useMedia((s) => s.app);
  const iconPng = useMedia((s) => s.iconPng);
  const demo = useConnection((s) => s.demo);

  const named = hasTrackInfo({ title, artist, album });

  const send = useCallback(
    (cmd: MediaCommand) => {
      if (Platform.OS === "ios") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      // The Mac answers with `state.media`, but only for the players that
      // announce themselves — flip locally so the button responds either way.
      if (cmd === "playpause") {
        useMedia.getState().setLocalPlaying(!useMedia.getState().playing);
      } else {
        useMedia.getState().setLocalPlaying(true);
      }
      // Demo mode moves the local card only — there is no Mac to talk to.
      if (demo) return;
      sendMessage({ v: PROTOCOL_VERSION, t: "m.cmd", cmd });
    },
    [demo],
  );

  return (
    <View style={styles.card}>
      <View style={styles.nowPlaying}>
        <View style={styles.art}>
          {iconPng ? (
            <Image
              source={{ uri: `data:image/png;base64,${iconPng}` }}
              style={styles.artImage}
              contentFit="contain"
            />
          ) : (
            <NoteIcon />
          )}
        </View>

        <View style={styles.text}>
          {named ? (
            <>
              <Text style={styles.title} numberOfLines={1}>
                {title ?? "Unknown track"}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {[artist, album].filter(Boolean).join(" · ") || (app ?? "")}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title} numberOfLines={1}>
                {playing ? "Playing" : "Nothing playing"}
              </Text>
              {/* macOS stopped handing out now-playing metadata to third-party
                  apps, so anything that is not Music or Spotify can be driven
                  but not named. Say that rather than show an empty card. */}
              <Text style={styles.artist} numberOfLines={2}>
                {playing
                  ? "This app doesn’t report track info"
                  : "Controls still work for any player"}
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.transport}>
        <TransportButton
          label="Previous track"
          onPress={() => send("prev")}
          icon={<SkipIcon direction="back" />}
        />
        <TransportButton
          label={playing ? "Pause" : "Play"}
          primary
          onPress={() => send("playpause")}
          icon={playing ? <PauseIcon /> : <PlayIcon />}
        />
        <TransportButton
          label="Next track"
          onPress={() => send("next")}
          icon={<SkipIcon direction="forward" />}
        />
      </View>
    </View>
  );
}

function TransportButton({
  label,
  icon,
  onPress,
  primary = false,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        pressed && styles.buttonPressed,
      ]}
    >
      {icon}
    </Pressable>
  );
}

function PlayIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Polygon points="8,5 19,12 8,19" fill={C.bg} />
    </Svg>
  );
}

function PauseIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Rect x={7} y={5} width={3.5} height={14} rx={1.2} fill={C.bg} />
      <Rect x={13.5} y={5} width={3.5} height={14} rx={1.2} fill={C.bg} />
    </Svg>
  );
}

function SkipIcon({ direction }: { direction: "back" | "forward" }) {
  const forward = direction === "forward";
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      style={forward ? undefined : styles.flipped}
    >
      <Polygon points="5,5 14,12 5,19" fill={C.text} />
      <Rect x={15.5} y={5} width={3} height={14} rx={1.2} fill={C.text} />
    </Svg>
  );
}

function NoteIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Path
        d="M9 18V6l10-2v12"
        stroke={C.dim}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M9 18a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 18zM19 16a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 19 16z"
        stroke={C.dim}
        strokeWidth={1.6}
        fill="none"
      />
    </Svg>
  );
}

const ART = 56;

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: 16,
    gap: 18,
  },
  nowPlaying: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  art: {
    width: ART,
    height: ART,
    borderRadius: 12,
    backgroundColor: C.bg2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  artImage: {
    width: ART - 10,
    height: ART - 10,
  },
  text: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: C.text,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: F.display,
  },
  artist: {
    color: C.muted,
    fontSize: 13,
  },
  transport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  buttonPrimary: {
    backgroundColor: C.accent,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  flipped: {
    transform: [{ scaleX: -1 }],
  },
});
