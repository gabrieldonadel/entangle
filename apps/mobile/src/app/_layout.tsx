import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "@/lib/router";
import { useSegments } from "expo-router";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useConnection } from "@/state/connection";
import { useOnboarding } from "@/state/onboarding";
import { C } from "@/features/onboarding/atoms";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const phase = useConnection((s) => s.phase);
  const segments = useSegments();
  const currentRoute = segments[0];
  const onPairScreen = currentRoute === "pair";
  const onboardingHydrated = useOnboarding((s) => s.hydrated);
  const onboardingComplete = useOnboarding((s) => s.completed);
  const hydrateOnboarding = useOnboarding((s) => s.hydrate);

  useEffect(() => {
    void hydrateOnboarding();
  }, [hydrateOnboarding]);

  useEffect(() => {
    if (!onboardingHydrated) return;
    if (phase === "open") {
      router.replace("/(tabs)");
    } else if (phase === "pairing") {
      router.replace("/pair");
    } else if (phase === "idle" && !onPairScreen) {
      // Stay on /pair when the universal link landed us here with params
      // — pair.tsx will read them and call connectWithToken itself.
      const destination = onboardingComplete ? "connect" : "onboarding";
      // Replacing the route we are already on remounts it, which would wipe
      // the discovery list and the pending selection every time a connection
      // is cancelled.
      if (currentRoute !== destination) router.replace(`/${destination}`);
    }
  }, [phase, onPairScreen, currentRoute, onboardingHydrated, onboardingComplete]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: C.bg,
            },
          }}
        >
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="connect" />
          <Stack.Screen name="pair" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
