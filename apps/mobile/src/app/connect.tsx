import { Stack } from "@/lib/router";
import { useCallback } from "react";

import { ScreenBg } from "@/features/onboarding/atoms";
import { FindMacScreen } from "@/features/discovery/FindMacScreen";
import { useConnection } from "@/state/connection";
import { useOnboarding } from "@/state/onboarding";

export default function ConnectScreen() {
  const enterDemo = useConnection((s) => s.enterDemo);

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
