import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export function Halos() {
  return (
    <View style={styles.root} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="xMinYMin slice">
        <Defs>
          <RadialGradient
            id="halo-tl"
            cx="12%"
            cy="0%"
            rx="60%"
            ry="55%">
            <Stop offset="0%" stopColor="#a3bbd6" stopOpacity={0.18} />
            <Stop offset="60%" stopColor="#a3bbd6" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient
            id="halo-br"
            cx="100%"
            cy="35%"
            rx="50%"
            ry="60%">
            <Stop offset="0%" stopColor="#7393b8" stopOpacity={0.15} />
            <Stop offset="65%" stopColor="#7393b8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo-tl)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo-br)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
});
