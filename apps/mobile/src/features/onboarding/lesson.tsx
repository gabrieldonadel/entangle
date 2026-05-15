import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";

import {
  createTrackpadGestures,
  type TrackpadHandlers,
} from "@/features/trackpad/gestures";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Path, RadialGradient, Stop } from "react-native-svg";

import {
  C,
  Eyebrow,
  F,
  Lede,
  PrimaryButton,
  ScreenBody,
  ScreenFooter,
  Title,
} from "./atoms";

export type GestureKind =
  | "pan"
  | "tap"
  | "right-click"
  | "scroll"
  | "long-drag"
  | "swipe-left"
  | "swipe-right"
  | "swipe-up";

export type DemoAnim =
  | "pan"
  | "tap"
  | "double"
  | "scroll"
  | "drag"
  | "swipe-prev"
  | "swipe-next"
  | "swipe-up";

export interface LessonItem {
  id: string;
  label: string;
  how: string;
  hint: string;
  anim: DemoAnim;
  detects: GestureKind[];
}

interface LessonScreenProps {
  stepLabel: string;
  title: string;
  lede: string;
  items: LessonItem[];
  finalCta?: string;
  onContinue: () => void;
}

export function LessonScreen({
  stepLabel,
  title,
  lede,
  items,
  finalCta = "Continue",
  onContinue,
}: LessonScreenProps) {
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  const remaining = items.filter((i) => !completed.has(i.id));
  const allDone = remaining.length === 0;

  const [activeAnim, setActiveAnim] = useState<DemoAnim>(items[0]!.anim);
  useEffect(() => {
    if (remaining.length === 0) return;
    let idx = 0;
    const tick = () => {
      const open = items.filter((i) => !completed.has(i.id));
      if (open.length === 0) return;
      setActiveAnim(open[idx % open.length]!.anim);
      idx += 1;
    };
    tick();
    const handle = setInterval(tick, 3000);
    return () => clearInterval(handle);
  }, [items, completed, remaining.length]);

  const activeItem = useMemo(
    () => items.find((i) => i.anim === activeAnim && !completed.has(i.id)),
    [items, activeAnim, completed],
  );

  const handleDetected = (kind: GestureKind) => {
    const matched = items.find((i) => i.detects.includes(kind));
    if (!matched || completed.has(matched.id)) return;
    void Haptics.selectionAsync();
    setCompleted((prev) => {
      const next = new Set(prev);
      next.add(matched.id);
      return next;
    });
  };

  return (
    <>
      <ScreenBody>
        <Eyebrow>{stepLabel}</Eyebrow>
        <View style={{ marginTop: 10 }}>
          <Title size={28}>{title}</Title>
        </View>
        <View style={{ marginTop: 8 }}>
          <Lede>{lede}</Lede>
        </View>

        <View style={{ marginTop: 18, flex: 1 }}>
          <TrackpadPad
            onGesture={handleDetected}
            hint={
              allDone
                ? "Nice. All done."
                : activeItem
                  ? activeItem.hint
                  : "Try a gesture"
            }
            anim={allDone ? null : activeAnim}
          />
        </View>

        <View style={{ marginTop: 16 }}>
          <GestureChecklist items={items} completed={completed} />
        </View>
      </ScreenBody>
      <ScreenFooter>
        <PrimaryButton disabled={!allDone} onPress={onContinue}>
          {allDone
            ? `${finalCta} →`
            : `${completed.size} of ${items.length} done`}
        </PrimaryButton>
      </ScreenFooter>
    </>
  );
}

interface TrackpadPadProps {
  onGesture: (kind: GestureKind) => void;
  hint: string;
  anim: DemoAnim | null;
}

function TrackpadPad({ onGesture, hint, anim }: TrackpadPadProps) {
  const gesture = useMemo(
    () => createTrackpadGestures(buildLessonHandlers(onGesture)),
    [onGesture],
  );
  return (
    <GestureDetector gesture={gesture}>
      <View style={padStyles.pad}>
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
        <View style={padStyles.center} pointerEvents="none">
          {anim ? <DemoFinger animation={anim} /> : null}
          <Text style={padStyles.hint}>{hint}</Text>
        </View>
      </View>
    </GestureDetector>
  );
}

// Lesson handlers reuse the production gesture configuration (thresholds,
// long-press timing, etc.) so the user gets the same feel as the real
// trackpad. We just intercept the events to tick off checklist items.
function buildLessonHandlers(
  onGesture: (kind: GestureKind) => void,
): TrackpadHandlers {
  // Require some actual finger travel before marking pan complete — otherwise
  // sub-pixel jitter on a touch would tick the item immediately.
  let panDistance = 0;
  return {
    onMove: (dx, dy) => {
      panDistance += Math.hypot(dx, dy);
      if (panDistance > 20) onGesture("pan");
    },
    onMoveEnd: () => {
      panDistance = 0;
    },
    onTap: () => onGesture("tap"),
    onRightClick: () => onGesture("right-click"),
    onScrollBegin: () => onGesture("scroll"),
    onDragBegin: () => onGesture("long-drag"),
    // Reverse the macOS dir mapping back to the user's physical finger
    // direction for the lesson labels: dir='right' (next space) is fired when
    // fingers move LEFT, so the "3-finger swipe ←" item completes.
    onSpaceSwipe: (dir) =>
      onGesture(dir === "right" ? "swipe-left" : "swipe-right"),
    onMissionControl: () => onGesture("swipe-up"),
  };
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base = {
    position: "absolute" as const,
    width: 10,
    height: 10,
    opacity: 0.4,
  };
  const variant = {
    tl: { top: 8, left: 8, borderTopWidth: 1, borderLeftWidth: 1 },
    tr: { top: 8, right: 8, borderTopWidth: 1, borderRightWidth: 1 },
    bl: { bottom: 8, left: 8, borderBottomWidth: 1, borderLeftWidth: 1 },
    br: { bottom: 8, right: 8, borderBottomWidth: 1, borderRightWidth: 1 },
  }[pos];
  return <View style={[base, variant, { borderColor: C.accent }]} />;
}

function GestureChecklist({
  items,
  completed,
}: {
  items: LessonItem[];
  completed: Set<string>;
}) {
  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => {
        const done = completed.has(item.id);
        return (
          <View
            key={item.id}
            style={[
              checklistStyles.row,
              {
                backgroundColor: done ? C.accentSoft : C.bg2,
                borderColor: done ? C.accent : C.border,
              },
            ]}
          >
            <View
              style={[
                checklistStyles.dot,
                {
                  backgroundColor: done ? C.accent : "transparent",
                  borderColor: done ? C.accent : C.borderStrong,
                },
              ]}
            >
              {done ? <Text style={checklistStyles.check}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  checklistStyles.label,
                  { color: done ? C.text : C.muted },
                ]}
              >
                {item.label}
              </Text>
              <Text
                style={[
                  checklistStyles.how,
                  { color: done ? C.accent : C.dim },
                ]}
              >
                {item.how}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function DemoFinger({ animation }: { animation: DemoAnim }) {
  return (
    <View style={{ width: 160, height: 80 }}>
      <Svg
        width={160}
        height={80}
        viewBox="0 0 160 80"
        style={{ opacity: 0.75 }}
      >
        <Defs>
          <RadialGradient id="finger" cx="35%" cy="30%">
            <Stop offset="0%" stopColor="#d6e4f4" />
            <Stop offset="100%" stopColor="#7393b8" />
          </RadialGradient>
        </Defs>
        {animation === "pan" || animation === "drag" ? (
          <Path
            d="M 20 40 L 140 40"
            stroke={C.accent}
            strokeWidth={1.5}
            fill="none"
            strokeDasharray="3 4"
            opacity={0.5}
          />
        ) : null}
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <FingerAnimation animation={animation} />
      </View>
    </View>
  );
}

function FingerAnimation({ animation }: { animation: DemoAnim }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [animation, t]);

  switch (animation) {
    case "pan":
      return <PanFinger t={t} />;
    case "tap":
      return <TapFinger t={t} />;
    case "double":
      return <DoubleTapFinger t={t} />;
    case "scroll":
      return <ScrollFingers t={t} />;
    case "drag":
      return <DragFinger t={t} />;
    case "swipe-prev":
      return <SwipePrevFingers t={t} />;
    case "swipe-next":
      return <SwipeNextFingers t={t} />;
    case "swipe-up":
      return <SwipeUpFingers t={t} />;
    default:
      return null;
  }
}

type SV = ReturnType<typeof useSharedValue<number>>;

type AnimStyle = ReturnType<typeof useAnimatedStyle>;

function FingerDot({ size = 24, style }: { size?: number; style?: AnimStyle }) {
  const base: ViewStyle = {
    position: "absolute",
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: "#7393b8",
  };
  return <Animated.View style={[base, style] as never} />;
}

function PanFinger({ t }: { t: SV }) {
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.1 || t.value > 0.9 ? 0 : 1,
    transform: [{ translateX: 10 + t.value * 120 }, { translateY: 20 }],
  }));
  return <FingerDot style={style} />;
}

function TapFinger({ t }: { t: SV }) {
  const style = useAnimatedStyle(() => {
    const phase = (t.value * 2) % 1;
    const opacity = phase < 0.1 || phase > 0.9 ? 0 : 1;
    const scale = phase > 0.4 && phase < 0.6 ? 0.8 : 1;
    return {
      opacity,
      transform: [{ translateX: 68 }, { translateY: 20 }, { scale }],
    };
  });
  return <FingerDot style={style} />;
}

function DoubleTapFinger({ t }: { t: SV }) {
  const left = useAnimatedStyle(() => {
    const phase = (t.value * 1.5) % 1;
    const opacity = phase < 0.1 || phase > 0.9 ? 0 : 1;
    const scale = phase > 0.35 && phase < 0.55 ? 0.8 : 1;
    return {
      opacity,
      transform: [{ translateX: 40 }, { translateY: 20 }, { scale }],
    };
  });
  const middle = useAnimatedStyle(() => {
    const phase = (t.value * 1.5) % 1;
    const opacity = phase < 0.1 || phase > 0.9 ? 0 : 1;
    const scale = phase > 0.35 && phase < 0.55 ? 0.8 : 1;
    return {
      opacity,
      transform: [{ translateX: 72 }, { translateY: 20 }, { scale }],
    };
  });
  const right = useAnimatedStyle(() => {
    const phase = (t.value * 1.5) % 1;
    const opacity = phase < 0.1 || phase > 0.9 ? 0 : 1;
    const scale = phase > 0.35 && phase < 0.55 ? 0.8 : 1;
    return {
      opacity,
      transform: [{ translateX: 104 }, { translateY: 20 }, { scale }],
    };
  });
  return (
    <>
      <FingerDot style={left} />
      <FingerDot style={middle} />
      <FingerDot style={right} />
    </>
  );
}

function ScrollFingers({ t }: { t: SV }) {
  const a = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.1 || phase > 0.9 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 48 }, { translateY: 40 - phase * 40 }],
    };
  });
  const b = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.1 || phase > 0.9 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 88 }, { translateY: 40 - phase * 40 }],
    };
  });
  return (
    <>
      <FingerDot size={22} style={a} />
      <FingerDot size={22} style={b} />
    </>
  );
}

function DragFinger({ t }: { t: SV }) {
  const style = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.1 || phase > 0.95 ? 0 : 1;
    const press = phase > 0.15 ? 0.8 : 1;
    const x = phase > 0.3 ? 20 + (phase - 0.3) * 160 : 20;
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: 20 }, { scale: press }],
    };
  });
  return <FingerDot style={style} />;
}

// 3-finger swipe right (Previous Space)
function SwipePrevFingers({ t }: { t: SV }) {
  const a = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 30 + phase * 60 - 30 }, { translateY: 10 }],
    };
  });
  const b = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 58 + phase * 60 - 30 }, { translateY: 22 }],
    };
  });
  const c = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 86 + phase * 60 - 30 }, { translateY: 34 }],
    };
  });
  return (
    <>
      <FingerDot size={20} style={a} />
      <FingerDot size={20} style={b} />
      <FingerDot size={20} style={c} />
    </>
  );
}

// 3-finger swipe left (Next Space) — reverse of Prev
function SwipeNextFingers({ t }: { t: SV }) {
  const a = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 30 + 30 - phase * 60 }, { translateY: 10 }],
    };
  });
  const b = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 58 + 30 - phase * 60 }, { translateY: 22 }],
    };
  });
  const c = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 86 + 30 - phase * 60 }, { translateY: 34 }],
    };
  });
  return (
    <>
      <FingerDot size={20} style={a} />
      <FingerDot size={20} style={b} />
      <FingerDot size={20} style={c} />
    </>
  );
}

// 3-finger swipe up (Mission Control) — bottom to top, fingers in a row
function SwipeUpFingers({ t }: { t: SV }) {
  const a = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 40 }, { translateY: 40 + 30 - phase * 60 }],
    };
  });
  const b = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 70 }, { translateY: 30 + 30 - phase * 60 }],
    };
  });
  const c = useAnimatedStyle(() => {
    const phase = t.value;
    const opacity = phase < 0.15 || phase > 0.85 ? 0 : 1;
    return {
      opacity,
      transform: [{ translateX: 100 }, { translateY: 40 + 30 - phase * 60 }],
    };
  });
  return (
    <>
      <FingerDot size={20} style={a} />
      <FingerDot size={20} style={b} />
      <FingerDot size={20} style={c} />
    </>
  );
}

const padStyles = StyleSheet.create({
  pad: {
    flex: 1,
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: "rgba(163,187,214,0.05)",
    overflow: "hidden",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  hint: {
    color: C.muted,
    fontFamily: F.mono,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1.7,
    textTransform: "uppercase",
    textAlign: "center",
  },
});

const checklistStyles = StyleSheet.create({
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  check: {
    color: C.bg,
    fontSize: 12,
    fontWeight: "700",
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: F.body,
  },
  how: {
    fontSize: 12,
    fontFamily: F.mono,
    letterSpacing: 0.5,
    marginTop: 1,
  },
});
