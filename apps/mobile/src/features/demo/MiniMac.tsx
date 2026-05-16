import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { C, F } from "@/features/onboarding/atoms";

export interface MiniMacProps {
  cursor: { x: number; y: number };
  ripple: { key: number; x: number; y: number } | null;
  onLayoutSize?: (size: { width: number; height: number }) => void;
}

export function MiniMac({ cursor, ripple, onLayoutSize }: MiniMacProps) {
  return (
    <View
      style={styles.frame}
      onLayout={(e) =>
        onLayoutSize?.({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
    >
      <View style={styles.menuBar}>
        <Svg width={10} height={12} viewBox="0 0 14 17">
          <Path
            d="M11.6 9c0-2 1.6-3 1.7-3-.9-1.4-2.3-1.6-2.8-1.6-1.2-.1-2.3.7-2.9.7-.6 0-1.5-.7-2.5-.7-1.3 0-2.5.7-3.1 1.9-1.3 2.3-.3 5.7 1 7.5.6.9 1.3 1.9 2.3 1.9.9 0 1.3-.6 2.4-.6s1.4.6 2.4.6c1 0 1.7-.9 2.3-1.8.5-.8.8-1.6 1-2.4-.5-.2-1.8-.8-1.8-2.5zM9.6 3.5c.5-.6.8-1.5.8-2.4-.8.1-1.6.4-2.2 1-.5.5-.9 1.4-.8 2.3.8 0 1.7-.4 2.2-.9z"
            fill="white"
          />
        </Svg>
        <Text style={styles.menuItemBold}>Finder</Text>
        <Text style={styles.menuItem}>File</Text>
        <Text style={styles.menuItem}>Edit</Text>
        <Text style={styles.menuItem}>View</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.menuItem}>10:42</Text>
      </View>

      <View style={styles.window}>
        <View style={styles.windowBar}>
          <View style={[styles.trafficLight, { backgroundColor: "#ec6a5e" }]} />
          <View style={[styles.trafficLight, { backgroundColor: "#f5bf4f" }]} />
          <View style={[styles.trafficLight, { backgroundColor: "#61c554" }]} />
        </View>
        <View style={styles.windowBody}>
          <View style={[styles.windowLine, { width: "60%", backgroundColor: "#ccc" }]} />
          <View style={[styles.windowLine, { width: "85%" }]} />
          <View style={[styles.windowLine, { width: "70%" }]} />
          <View style={[styles.windowLine, { width: "50%" }]} />
        </View>
      </View>

      {ripple ? <ClickRipple key={ripple.key} x={ripple.x} y={ripple.y} /> : null}

      <View
        pointerEvents="none"
        style={[
          styles.cursorWrap,
          { transform: [{ translateX: cursor.x - 2 }, { translateY: cursor.y - 1 }] },
        ]}
      >
        <Svg width={14} height={20} viewBox="0 0 14 20">
          <Path
            d="M 1 1 L 1 14 L 4.5 11 L 7 17 L 9 16 L 6.5 10 L 11 10 Z"
            fill="white"
            stroke="#222"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}

function ClickRipple({ x, y }: { x: number; y: number }) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 2.5,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        {
          transform: [
            { translateX: x - 12 },
            { translateY: y - 12 },
            { scale },
          ],
          opacity,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a2540",
    borderWidth: 1,
    borderColor: C.borderStrong,
    position: "relative",
  },
  menuBar: {
    height: 18,
    paddingHorizontal: 8,
    backgroundColor: "rgba(0,0,0,0.30)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuItem: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: F.body,
    fontSize: 9,
    fontWeight: "500",
  },
  menuItemBold: {
    color: "rgba(255,255,255,0.95)",
    fontFamily: F.body,
    fontSize: 9,
    fontWeight: "600",
  },
  window: {
    position: "absolute",
    left: "14%",
    top: "28%",
    width: "54%",
    aspectRatio: 4 / 3,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 6,
    overflow: "hidden",
  },
  windowBar: {
    height: 14,
    backgroundColor: "#e8e8ec",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#c8c8cc",
  },
  trafficLight: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  windowBody: {
    padding: 6,
    paddingTop: 6,
    gap: 4,
  },
  windowLine: {
    height: 3,
    borderRadius: 1,
    backgroundColor: "#ddd",
  },
  cursorWrap: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  ripple: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
  },
});
