import { type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export const C = {
  bg: "#0a0c10",
  bg2: "#14171d",
  surface: "rgba(20, 23, 29, 0.72)",
  border: "rgba(163, 187, 214, 0.10)",
  borderStrong: "rgba(163, 187, 214, 0.22)",
  text: "#f5f7fa",
  muted: "#8a93a6",
  dim: "#5a6378",
  accent: "#a3bbd6",
  accentSoft: "rgba(163, 187, 214, 0.10)",
};

const monoFamily = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
}) as string;

export const F = {
  display: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System",
  }) as string,
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "System",
  }) as string,
  mono: monoFamily,
};

export function Orb({ size = 80 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        shadowColor: "#000",
        shadowOpacity: 0.55,
        shadowRadius: size * 0.4,
        shadowOffset: { width: 0, height: size * 0.2 },
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`orb-${size}`} cx="32%" cy="28%" r="75%">
            <Stop offset="0%" stopColor="#d6e4f4" />
            <Stop offset="55%" stopColor="#7393b8" />
            <Stop offset="100%" stopColor="#2c3e58" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#orb-${size})`} />
        <Ellipse cx={36} cy={36} rx={20} ry={11} fill="#ffffff" opacity={0.7} />
      </Svg>
    </View>
  );
}

export function Progress({
  step,
  total = 5,
}: {
  step: number;
  total?: number;
}) {
  return (
    <View style={atomStyles.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            atomStyles.progressTick,
            {
              width: i === step ? 22 : 12,
              backgroundColor: i <= step ? C.accent : "rgba(255,255,255,0.10)",
            },
          ]}
        />
      ))}
    </View>
  );
}

export function TopBar({
  step,
  total = 5,
  onSkip,
  showSkip = true,
}: {
  step?: number;
  total?: number;
  onSkip?: () => void;
  showSkip?: boolean;
}) {
  return (
    <View style={atomStyles.topBar}>
      {step != null ? <Progress step={step} total={total} /> : <View />}
      {showSkip ? (
        <Pressable onPress={onSkip} hitSlop={12}>
          <Text style={atomStyles.skip}>Skip</Text>
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

export function Eyebrow({
  children,
  color = C.muted,
}: {
  children: ReactNode;
  color?: string;
}) {
  return <Text style={[atomStyles.eyebrow, { color }]}>{children}</Text>;
}

export function Title({
  children,
  size = 36,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <Text
      style={[
        atomStyles.title,
        {
          fontSize: size,
          lineHeight: Math.round(size * 1.05),
        },
      ]}
    >
      {children}
    </Text>
  );
}

export function Lede({ children }: { children: ReactNode }) {
  return <Text style={atomStyles.lede}>{children}</Text>;
}

export function PrimaryButton({
  children,
  onPress,
  disabled,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        atomStyles.primary,
        disabled && atomStyles.primaryDisabled,
        pressed && !disabled && atomStyles.primaryPressed,
      ]}
    >
      <Text
        style={[
          atomStyles.primaryLabel,
          disabled && atomStyles.primaryLabelDisabled,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function GhostLink({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={atomStyles.ghost}>
      <Text style={atomStyles.ghostLabel}>{children}</Text>
    </Pressable>
  );
}

export function ScreenBg({
  children,
  variant = "glow",
}: {
  children: ReactNode;
  variant?: "glow" | "plain";
}) {
  return (
    <View style={atomStyles.bgRoot}>
      {variant === "glow" && (
        <View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <View style={atomStyles.glowTopLeft} />
          <View style={atomStyles.glowBottomRight} />
        </View>
      )}

      <SafeAreaView style={atomStyles.bgContent}>{children}</SafeAreaView>
    </View>
  );
}

export function ScreenBody({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[atomStyles.body, style]}>{children}</View>;
}

export function ScreenFooter({ children }: { children: ReactNode }) {
  return <View style={atomStyles.footer}>{children}</View>;
}

export function Spinner({ size = 14 }: { size?: number }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 50 50">
        <Circle
          cx="25"
          cy="25"
          r="20"
          stroke={C.border}
          strokeWidth={4}
          fill="none"
        />
        <Path
          d="M 25 5 a 20 20 0 0 1 0 40"
          stroke={C.accent}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

const atomStyles = StyleSheet.create({
  bgRoot: {
    flex: 1,
    backgroundColor: C.bg,
    overflow: "hidden",
  },
  bgContent: {
    flex: 1,
  },
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
  topBar: {
    paddingTop: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressTick: {
    height: 3,
    borderRadius: 2,
  },
  skip: {
    color: C.dim,
    fontSize: 13,
    fontFamily: F.mono,
    fontWeight: "500",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  eyebrow: {
    fontFamily: F.mono,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: C.text,
    fontWeight: "600",
    letterSpacing: -1,
  },
  lede: {
    color: C.muted,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: F.body,
  },
  body: {
    flex: 1,
    padding: 28,
    paddingTop: 32,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 6,
    alignItems: "center",
  },
  primary: {
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: C.text,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryDisabled: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  primaryPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  primaryLabel: {
    color: C.bg,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: F.body,
    letterSpacing: -0.15,
  },
  primaryLabelDisabled: {
    color: C.dim,
  },
  ghost: {
    paddingVertical: 8,
  },
  ghostLabel: {
    color: C.muted,
    fontSize: 14,
    fontWeight: "500",
    fontFamily: F.body,
  },
});
