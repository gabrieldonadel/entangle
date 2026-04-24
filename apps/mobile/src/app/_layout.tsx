import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router } from '@/lib/router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useConnection } from '@/state/connection';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const phase = useConnection((s) => s.phase);

  useEffect(() => {
    if (phase === 'open') {
      router.replace('/(tabs)');
    } else if (phase === 'idle') {
      router.replace('/connect');
    }
  }, [phase]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="connect" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
