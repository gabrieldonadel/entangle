import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from '@/lib/router';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useConnection } from '@/state/connection';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const phase = useConnection((s) => s.phase);
  const segments = useSegments();
  const onPairScreen = segments[0] === 'pair';

  useEffect(() => {
    if (phase === 'open') {
      router.replace('/(tabs)');
    } else if (phase === 'pairing') {
      router.replace('/pair');
    } else if (phase === 'idle' && !onPairScreen) {
      // Stay on /pair when the universal link landed us here with params
      // — pair.tsx will read them and call connectWithToken itself.
      router.replace('/connect');
    }
  }, [phase, onPairScreen]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="connect" />
          <Stack.Screen name="pair" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
