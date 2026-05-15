import * as WebBrowser from "expo-web-browser";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

import { router } from "@/lib/router";
import {
  C,
  Eyebrow,
  F,
  GhostLink,
  Lede,
  Orb,
  PrimaryButton,
  ScreenBody,
  ScreenFooter,
  Title,
  TopBar,
} from "@/features/onboarding/atoms";
import { LessonScreen } from "@/features/onboarding/lesson";
import { useOnboarding } from "@/state/onboarding";

const DOWNLOAD_URL = "https://entangle.donadel.dev";

type Step = "welcome" | "install" | "basics" | "scroll" | "power";
const ORDER: Step[] = ["welcome", "install", "basics", "scroll", "power"];

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>("welcome");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const markComplete = useOnboarding((s) => s.markComplete);

  const goNext = useCallback(() => {
    const idx = ORDER.indexOf(step);
    if (idx < ORDER.length - 1) {
      setDirection("forward");
      setStep(ORDER[idx + 1]!);
    }
  }, [step]);

  const goBack = useCallback(() => {
    const idx = ORDER.indexOf(step);
    if (idx > 0) {
      setDirection("back");
      setStep(ORDER[idx - 1]!);
    }
  }, [step]);

  const skipAll = useCallback(async () => {
    await markComplete();
    router.replace("/connect");
  }, [markComplete]);

  const renderStep = (s: Step): ReactNode => {
    switch (s) {
      case "welcome":
        return <Welcome onNext={goNext} onSkip={skipAll} />;
      case "install":
        return <InstallMac onNext={goNext} onSkip={skipAll} />;
      case "basics":
        return (
          <LessonScreen
            stepLabel="Step 2 of 4"
            title="Trackpad basics."
            lede="Three things to learn. Try them below."
            onContinue={goNext}
            items={[
              {
                id: "move",
                label: "Move the cursor",
                how: "Drag a finger",
                hint: "drag across the pad",
                anim: "pan",
                detects: ["pan"],
              },
              {
                id: "click",
                label: "Click",
                how: "Tap once",
                hint: "tap to click",
                anim: "tap",
                detects: ["tap"],
              },
              {
                id: "right",
                label: "Right‑click",
                how: "Three‑finger double-tap",
                hint: "double-tap with three fingers",
                anim: "double",
                detects: ["right-click"],
              },
            ]}
          />
        );
      case "scroll":
        return (
          <LessonScreen
            stepLabel="Step 3 of 4"
            title="Scroll & drag."
            lede="Now the moves that move things."
            onContinue={goNext}
            items={[
              {
                id: "scroll",
                label: "Scroll",
                how: "Two‑finger swipe",
                hint: "two‑finger swipe",
                anim: "scroll",
                detects: ["scroll"],
              },
              {
                id: "drag",
                label: "Drag",
                how: "Hold ~1s, then move",
                hint: "hold then drag",
                anim: "drag",
                detects: ["long-drag"],
              },
            ]}
          />
        );
      case "power":
        return (
          <LessonScreen
            stepLabel="Step 4 of 4"
            title="Power moves."
            lede="Three‑finger swipes drive macOS Spaces."
            onContinue={() => router.navigate("/connect")}
            items={[
              {
                id: "left",
                label: "Previous Space",
                how: "3‑finger swipe ←",
                hint: "3‑finger swipe right",
                anim: "swipe-prev",
                detects: ["swipe-right"],
              },
              {
                id: "right",
                label: "Next Space",
                how: "3‑finger swipe →",
                anim: "swipe-next",
                hint: "3‑finger swipe left",
                detects: ["swipe-left"],
              },
              {
                id: "up",
                label: "Mission Control",
                how: "3‑finger swipe ↑",
                hint: "3‑finger swipe up",
                anim: "swipe-up",
                detects: ["swipe-up"],
              },
            ]}
          />
        );
    }
  };

  const canGoBack = ORDER.indexOf(step) > 0;

  const backSwipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([20, 9999])
        .failOffsetY([-30, 30])
        .onEnd((e) => {
          if (e.translationX > 60 && canGoBack) {
            goBack();
          }
        })
        .runOnJS(true),
    [goBack, canGoBack],
  );

  const headerStep =
    step === "welcome"
      ? undefined
      : step === "install"
        ? 0
        : step === "basics"
          ? 1
          : step === "scroll"
            ? 2
            : step === "power"
              ? 3
              : 4;
  const showSkip = step !== "welcome";

  return (
    <View style={styles.root}>
      {/* Fixed background glow */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.glowTopLeft} />
        <View style={styles.glowBottomRight} />
      </View>

      <SafeAreaView style={styles.safe}>
        <TopBar
          step={headerStep}
          total={4}
          showSkip={showSkip}
          onSkip={skipAll}
        />

        {/* Sliding content */}
        <View style={styles.contentClip}>
          <Animated.View
            key={step}
            entering={(direction === "forward"
              ? SlideInRight
              : SlideInLeft
            ).duration(260)}
            exiting={(direction === "forward"
              ? SlideOutLeft
              : SlideOutRight
            ).duration(260)}
            style={StyleSheet.absoluteFill}
          >
            {renderStep(step)}
          </Animated.View>
        </View>
      </SafeAreaView>

      {/* Left-edge swipe-back strip (transparent, only catches edge pans) */}
      {canGoBack ? (
        <GestureDetector gesture={backSwipe}>
          <View style={styles.backEdge} />
        </GestureDetector>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Welcome
// ─────────────────────────────────────────────────────────────

function Welcome({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <ScreenBody style={{ paddingTop: 16 }}>
        <View style={welcomeStyles.hero}>
          <View style={welcomeStyles.orbStage}>
            <Svg
              width={320}
              height={200}
              viewBox="0 0 320 200"
              style={StyleSheet.absoluteFill}
            >
              {/* Single sine wave — attaches at the right edge of the
                  left orb (x=110) and ends near the left edge of the right
                  orb (x=250), both at the vertical center y=100. */}
              <Path
                d="M 110 100 Q 145 130, 180 100 T 250 100"
                stroke="rgba(163,187,214,0.65)"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d="M 110 100 Q 145 130, 180 100 T 250 100"
                stroke="#d6e4f4"
                strokeWidth={1}
                fill="none"
                strokeDasharray="2 6"
                opacity={0.7}
                strokeLinecap="round"
              />
            </Svg>
            <View style={{ position: "absolute", left: 30, top: 60 }}>
              <Orb size={80} />
            </View>
            <View style={{ position: "absolute", right: 20, top: 70 }}>
              <Orb size={60} />
            </View>
          </View>

          <View style={welcomeStyles.copy}>
            <Eyebrow color={C.accent}>Entangle</Eyebrow>
            <View style={{ marginTop: 14, alignItems: "center" }}>
              <Title size={40}>{`Your Mac's pointer,\nin your pocket.`}</Title>
            </View>
            <Text style={welcomeStyles.tag}>
              A trackpad & keyboard for your Mac. Stays on your Wi‑Fi. Free
              forever.
            </Text>
          </View>
        </View>
      </ScreenBody>
      <ScreenFooter>
        <PrimaryButton onPress={onNext}>Get started →</PrimaryButton>
        <GhostLink onPress={onSkip}>I already have it set up</GhostLink>
      </ScreenFooter>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Install on Mac
// ─────────────────────────────────────────────────────────────

function InstallMac({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = "entangle.donadel.dev";

  const copy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      <ScreenBody>
        <Eyebrow>Step 1 of 4</Eyebrow>
        <View style={{ marginTop: 12 }}>
          <Title size={32}>Install on your Mac.</Title>
        </View>
        <View style={{ marginTop: 12 }}>
          <Lede>
            Open this URL in a browser on the Mac you want to control.
          </Lede>
        </View>

        <View style={installStyles.urlChip}>
          <View style={installStyles.urlChipLeft}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Circle
                cx={12}
                cy={12}
                r={10}
                stroke={C.accent}
                strokeWidth={2}
                fill="none"
              />
              <Path
                d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                stroke={C.accent}
                strokeWidth={2}
                fill="none"
              />
            </Svg>
            <Text style={installStyles.url} numberOfLines={1}>
              {url}
            </Text>
          </View>
          <Pressable onPress={copy} style={installStyles.copyBtn}>
            <Text style={installStyles.copyText}>
              {copied ? "✓ Copied" : "Copy"}
            </Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 28, gap: 16 }}>
          <HelpRow
            num="1"
            title="Download Entangle.dmg"
            body="From the link above."
          />
          <HelpRow
            num="2"
            title="Open the app"
            body="It lives in your menu bar."
          />
          <HelpRow
            num="3"
            title="Grant Accessibility"
            body="Required to move the system pointer."
          />
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(DOWNLOAD_URL)}
          style={installStyles.openLink}
        >
          <Text style={installStyles.openLinkText}>Open in browser</Text>
        </Pressable>
      </ScreenBody>
      <ScreenFooter>
        <PrimaryButton onPress={onNext}>{`I’ve installed it →`}</PrimaryButton>
      </ScreenFooter>
    </>
  );
}

function HelpRow({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <View style={installStyles.helpRow}>
      <View style={installStyles.helpNum}>
        <Text style={installStyles.helpNumText}>{num}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={installStyles.helpTitle}>{title}</Text>
        <Text style={installStyles.helpBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },
  safe: { flex: 1 },
  contentClip: { flex: 1, overflow: "hidden" },
  glowTopLeft: {
    position: "absolute",
    top: -160,
    left: -160,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: "rgba(163,187,214,0.06)",
  },
  glowBottomRight: {
    position: "absolute",
    bottom: -200,
    right: -160,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(163,187,214,0.04)",
  },
  backEdge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 24,
  },
});

const welcomeStyles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  orbStage: {
    width: 320,
    height: 200,
    position: "relative",
  },
  copy: {
    marginTop: 48,
    alignItems: "center",
  },
  tag: {
    marginTop: 16,
    color: C.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontFamily: F.body,
    maxWidth: 280,
  },
});

const installStyles = StyleSheet.create({
  urlChip: {
    marginTop: 28,
    padding: 18,
    backgroundColor: C.bg2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  urlChipLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  url: {
    color: C.text,
    fontSize: 14,
    fontFamily: F.mono,
    fontWeight: "500",
    flexShrink: 1,
  },
  copyBtn: {
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.borderStrong,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  copyText: {
    color: C.accent,
    fontSize: 11,
    fontFamily: F.mono,
    fontWeight: "500",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  helpRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  helpNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  helpNumText: {
    color: C.accent,
    fontSize: 10,
    fontFamily: F.mono,
    fontWeight: "500",
  },
  helpTitle: {
    color: C.text,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: F.body,
  },
  helpBody: {
    color: C.muted,
    fontSize: 13,
    fontFamily: F.body,
    marginTop: 2,
  },
  openLink: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  openLinkText: {
    color: C.accent,
    fontSize: 13,
    fontFamily: F.mono,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
