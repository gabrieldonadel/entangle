import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "@/lib/router";
import { useCallback, useEffect } from "react";

import { ScreenBg } from "@/features/onboarding/atoms";
import {
  FindMacScreen,
  LAST_HOST_KEY,
} from "@/features/discovery/FindMacScreen";
import { hasUserDisconnected, useConnection } from "@/state/connection";
import type { ConnectionTarget } from "@/state/connection";
import { useOnboarding } from "@/state/onboarding";

export default function ConnectScreen() {
  const connect = useConnection((s) => s.connect);
  const enterDemo = useConnection((s) => s.enterDemo);

  // Restore the last-paired host on mount, unless the user explicitly
  // disconnected (in which case they're back here on purpose).
  useEffect(() => {
    if (hasUserDisconnected()) return;
    AsyncStorage.getItem(LAST_HOST_KEY).then((raw) => {
      if (!raw || hasUserDisconnected()) return;
      try {
        const target = JSON.parse(raw) as ConnectionTarget;
        connect(target);
      } catch {}
    });
  }, [connect]);

  const handleTryDemo = useCallback(() => {
    void useOnboarding.getState().markComplete();
    enterDemo();
  }, [enterDemo]);

  return (
    <ScreenBg>
      <Stack.Screen options={{ title: "Connect" }} />
      <FindMacScreen onTryDemo={handleTryDemo} />
    </ScreenBg>
  );
}
