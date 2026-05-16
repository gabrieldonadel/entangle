import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { C, F } from "@/features/onboarding/atoms";
import { useConnection } from "@/state/connection";

export function PracticeBanner() {
  const disconnect = useConnection((s) => s.disconnect);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.12],
  });

  return (
    <View style={styles.banner}>
      <View style={styles.dotWrap}>
        <Animated.View
          style={[
            styles.halo,
            { transform: [{ scale: haloScale }], opacity: haloOpacity },
          ]}
        />
        <View style={styles.dot} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Practice mode</Text>
        <Text style={styles.subtitle}>No real Mac connected.</Text>
      </View>
      <Pressable
        onPress={disconnect}
        accessibilityLabel="Connect to a real Mac"
        style={styles.button}
      >
        <Text style={styles.buttonText}>Connect</Text>
      </Pressable>
    </View>
  );
}

const AMBER = "#f0b14b";

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(163,187,214,0.06)",
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dotWrap: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: AMBER,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: AMBER,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: C.accent,
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  subtitle: {
    color: C.muted,
    fontFamily: F.body,
    fontSize: 11,
    marginTop: 1,
  },
  button: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 999,
  },
  buttonText: {
    color: C.text,
    fontFamily: F.mono,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
