import { StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import type { DemoIconKind } from "@/state/demo";

export interface DemoAppIconProps {
  kind: DemoIconKind;
  bg: string;
  size?: number;
}

export function DemoAppIcon({ kind, bg, size = 58 }: DemoAppIconProps) {
  const r = size * 0.235;
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: r, backgroundColor: bg },
      ]}
    >
      {kind === "notes" ? (
        <View style={styles.notesTopBand} />
      ) : null}
      <Glyph kind={kind} size={size} />
    </View>
  );
}

function Glyph({ kind, size }: { kind: DemoIconKind; size: number }) {
  const w = (pct: number) => size * pct;
  switch (kind) {
    case "android":
      return (
        <Svg width={w(0.62)} height={w(0.62)} viewBox="0 0 24 24">
          <Path
            d="M5 5 L12 19 L19 5 L16 5 L12 13 L8 5 Z"
            stroke="#0a0c10"
            strokeWidth={2}
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx={18} cy={18} r={3} fill="#3ddc84" />
        </Svg>
      );
    case "xcode":
      return (
        <Svg width={w(0.62)} height={w(0.62)} viewBox="0 0 24 24">
          <Path d="M4 16 L13 7 L17 11 L8 20 Z" fill="#fff" />
          <Rect
            x={14}
            y={4}
            width={6}
            height={3}
            rx={1}
            transform="rotate(45 17 5.5)"
            fill="#fff"
          />
        </Svg>
      );
    case "cmux":
      return (
        <Svg width={w(0.62)} height={w(0.62)} viewBox="0 0 24 24">
          <Path d="M8 5 L18 12 L8 19 Z" fill="#7c83ff" />
        </Svg>
      );
    case "chrome":
      return (
        <Svg width={w(0.76)} height={w(0.76)} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={11} fill="#fff" />
          <Path
            d="M12 2 a 10 10 0 0 1 8.66 5 L 12 7 a 5 5 0 0 0 -4.33 2.5 Z"
            fill="#ea4335"
          />
          <Path
            d="M20.66 7 a 10 10 0 0 1 -3.66 13.5 L 12 12 a 5 5 0 0 0 -.5 -4.5 Z"
            fill="#fbbc04"
          />
          <Path
            d="M17 20.5 a 10 10 0 0 1 -13.5 -5 L 7.67 9.5 a 5 5 0 0 0 4.83 2.5 Z"
            fill="#34a853"
          />
          <Circle cx={12} cy={12} r={4} fill="#4285f4" />
        </Svg>
      );
    case "vscode":
      return (
        <Svg width={w(0.74)} height={w(0.74)} viewBox="0 0 24 24">
          <Path
            d="M17 3 L20 4.5 V 19.5 L 17 21 L 6 13 L 3 15 L 2 14 L 5 12 L 2 10 L 3 9 L 6 11 Z"
            fill="#0098ee"
          />
          <Path d="M17 6 L9 12 L17 18 Z" fill="#fff" />
        </Svg>
      );
    case "slack":
      return (
        <Svg width={w(0.64)} height={w(0.64)} viewBox="0 0 24 24">
          <Rect x={3} y={9} width={6} height={2.5} rx={1.25} fill="#36c5f0" />
          <Rect x={3} y={13} width={9} height={2.5} rx={1.25} fill="#2eb67d" />
          <Rect x={14} y={13} width={6} height={2.5} rx={1.25} fill="#ecb22e" />
          <Rect x={11} y={9} width={9} height={2.5} rx={1.25} fill="#e01e5a" />
        </Svg>
      );
    case "linear":
      return (
        <Svg width={w(0.64)} height={w(0.64)} viewBox="0 0 24 24">
          <Path
            d="M3 9 L 9 3 M3 13 L 13 3 M3 17 L 17 3 M5 21 L 21 5 M9 21 L 21 9 M13 21 L 21 13 M17 21 L 21 17"
            stroke="#fff"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </Svg>
      );
    case "mirror":
      return (
        <Svg width={w(0.62)} height={w(0.62)} viewBox="0 0 24 24">
          <Rect
            x={3}
            y={5}
            width={11}
            height={15}
            rx={2}
            fill="#c4cbff"
            stroke="#fff"
            strokeWidth={0.6}
          />
          <Rect x={9} y={3} width={12} height={18} rx={2.5} fill="#fff" />
          <Rect
            x={11}
            y={5}
            width={8}
            height={14}
            rx={1}
            fill="#7c83ff"
            opacity={0.35}
          />
        </Svg>
      );
    case "wa":
      return (
        <Svg width={w(0.68)} height={w(0.68)} viewBox="0 0 24 24">
          <Path
            d="M12 2 C 6.5 2 2 6.5 2 12 c 0 1.8 .5 3.5 1.3 5 L 2 22 l 5.2 -1.3 c 1.4 .8 3 1.3 4.8 1.3 c 5.5 0 10 -4.5 10 -10 S 17.5 2 12 2 Z M 9 7 c .3 0 .6 .2 .8 .5 l .7 1.5 c .2 .4 0 .8 -.3 1.1 L 9.5 11 c 1 1.5 2 2.5 3.5 3.5 l .9 -.7 c .3 -.2 .7 -.3 1 -.1 l 1.7 .7 c .3 .1 .5 .4 .5 .7 c 0 1.5 -1.2 2.5 -2.5 2.5 c -3 0 -7 -4 -7 -7 c 0 -1.3 1 -2.5 2.4 -2.5 z"
            fill="#fff"
          />
        </Svg>
      );
    case "discord":
      return (
        <Svg width={w(0.64)} height={w(0.64)} viewBox="0 0 24 24">
          <Path
            d="M19 5 c -1.5 -.7 -3 -1.2 -4.6 -1.5 l -.3 .5 c -.4 0 -1.3 -.1 -2.1 -.1 c -.8 0 -1.7 .1 -2.1 .1 L 9.6 3.5 C 8 3.8 6.5 4.3 5 5 C 2.5 8.5 1.8 12 2 15.5 c 1.7 1.3 3.4 2 5 2.5 l .5 -1 c -.8 -.3 -1.6 -.7 -2.4 -1.3 c .2 -.1 .4 -.3 .6 -.4 c 4.2 2 8.7 2 12.9 0 c .2 .1 .4 .3 .6 .4 c -.8 .6 -1.6 1 -2.4 1.3 l .5 1 c 1.6 -.5 3.3 -1.2 5 -2.5 C 22.5 11.5 21.4 8 19 5 Z M 9 13 c -1 0 -1.7 -.9 -1.7 -2 c 0 -1.1 .7 -2 1.7 -2 s 1.7 .9 1.7 2 c 0 1.1 -.7 2 -1.7 2 z m 6 0 c -1 0 -1.7 -.9 -1.7 -2 c 0 -1.1 .7 -2 1.7 -2 s 1.7 .9 1.7 2 c 0 1.1 -.7 2 -1.7 2 z"
            fill="#fff"
          />
        </Svg>
      );
    case "sim":
      return (
        <Svg width={w(0.62)} height={w(0.62)} viewBox="0 0 24 24">
          <Rect
            x={7}
            y={3}
            width={11}
            height={18}
            rx={2.5}
            fill="#fff"
            stroke="#fff"
            strokeWidth={0.6}
          />
          <Rect x={8.5} y={5} width={8} height={14} rx={1.2} fill="#4f9eff" />
          <Rect x={11} y={3.5} width={3} height={1} rx={0.5} fill="#4f9eff" />
        </Svg>
      );
    case "notes":
      return (
        <Svg width={w(0.64)} height={w(0.64)} viewBox="0 0 24 24">
          <Line x1={6} y1={12} x2={18} y2={12} stroke="#c9c9d0" strokeWidth={1.2} />
          <Line x1={6} y1={15} x2={18} y2={15} stroke="#c9c9d0" strokeWidth={1.2} />
          <Line x1={6} y1={18} x2={14} y2={18} stroke="#c9c9d0" strokeWidth={1.2} />
        </Svg>
      );
    case "finder":
      return (
        <Svg width={w(0.64)} height={w(0.64)} viewBox="0 0 24 24">
          <Path d="M4 4 L12 4 L12 20 L4 20 Z" fill="#e6f0ff" opacity={0.9} />
          <Path d="M12 4 L20 4 L20 20 L12 20 Z" fill="#fff" />
          <Circle cx={8} cy={10} r={1} fill="#0a0c10" />
          <Circle cx={16} cy={10} r={1} fill="#0a0c10" />
          <Path
            d="M8 15 Q 12 18 16 15"
            stroke="#0a0c10"
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      );
    case "preview":
      return (
        <Svg width={w(0.64)} height={w(0.64)} viewBox="0 0 24 24">
          <Rect
            x={3}
            y={3}
            width={14}
            height={14}
            rx={1.5}
            fill="#fff"
            stroke="#a6c8e8"
            strokeWidth={0.5}
          />
          <Circle cx={14} cy={14} r={5.5} fill="#fff" stroke="#3a3a44" strokeWidth={1.2} />
          <Line x1={18} y1={18} x2={21} y2={21} stroke="#3a3a44" strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    case "activity":
      return (
        <Svg width={w(0.76)} height={w(0.76)} viewBox="0 0 24 24">
          <Path
            d="M2 14 L 5 14 L 7 8 L 10 18 L 13 6 L 16 14 L 22 14"
            stroke="#3ddc84"
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "entangle":
      return (
        <Svg width={w(0.76)} height={w(0.76)} viewBox="0 0 24 24">
          <Defs>
            <RadialGradient id="orb-mini" cx="35%" cy="30%">
              <Stop offset="0%" stopColor="#d6e4f4" />
              <Stop offset="100%" stopColor="#7393b8" />
            </RadialGradient>
          </Defs>
          <Path
            d="M5 12 Q 9 6, 12 12 T 19 12"
            stroke="#a3bbd6"
            strokeWidth={1}
            fill="none"
            opacity={0.6}
          />
          <Circle cx={7} cy={12} r={2.5} fill="url(#orb-mini)" />
          <Circle cx={17} cy={12} r={2} fill="url(#orb-mini)" />
        </Svg>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  notesTopBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "24%",
    backgroundColor: "#fde68a",
  },
});
