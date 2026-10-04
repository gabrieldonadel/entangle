import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-screens/experimental";

import { VolumeBar } from "@/features/audio/VolumeBar";
import { PracticeBanner } from "@/features/demo/PracticeBanner";
import { MediaPlayer } from "@/features/media/MediaPlayer";
import { C } from "@/features/onboarding/atoms";
import { useConnection } from "@/state/connection";

export default function MediaScreen() {
  const demo = useConnection((s) => s.demo);
  const serverCaps = useConnection((s) => s.serverCaps);
  // Older Macs ignore `a.*` / `m.cmd`, so hide the control rather than let it
  // move with no effect. Demo mode has no caps list but drives both locally.
  const hasAudio = demo || serverCaps.includes("audio");
  const hasMedia = demo || serverCaps.includes("media");

  return (
    <View style={styles.root}>
      <SafeAreaView edges={{ top: true, bottom: true }} style={styles.safe}>
        {demo ? (
          <View style={styles.bannerWrap}>
            <PracticeBanner />
          </View>
        ) : null}

        <View style={styles.header}>
          <Text style={styles.title}>Media</Text>
          <Text style={styles.subtitle}>
            Volume and playback on your Mac.
          </Text>
        </View>

        <View style={styles.body}>
          {hasAudio ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Volume</Text>
              <VolumeBar />
            </View>
          ) : null}

          {hasMedia ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Now playing</Text>
              <MediaPlayer />
            </View>
          ) : null}

          {!hasAudio && !hasMedia ? (
            <Text style={styles.empty}>
              This Mac is running a version of Entangle without media controls.
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 28,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  empty: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  bannerWrap: {
    paddingTop: 8,
    paddingBottom: 4,
  },
});
