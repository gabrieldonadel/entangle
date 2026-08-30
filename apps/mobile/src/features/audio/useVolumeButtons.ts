import { useEffect } from "react";

import { PROTOCOL_VERSION } from "@entangle/protocol";
import {
  addUnavailableListener,
  addVolumeButtonListener,
  isSupported,
  start,
  stop,
} from "volume-buttons";

import { sendMessage } from "@/net/send";
import { useConnection } from "@/state/connection";
import { useSettings } from "@/state/settings";

/**
 * Sends the phone's hardware volume buttons to the Mac.
 *
 * Only runs while a real Mac is connected and advertising `audio` — taking over
 * the phone's volume buttons when they would do nothing is worse than leaving
 * them alone. Demo mode is excluded for the same reason.
 */
export function useVolumeButtons() {
  const phase = useConnection((s) => s.phase);
  const demo = useConnection((s) => s.demo);
  const serverCaps = useConnection((s) => s.serverCaps);
  const enabled = useSettings((s) => s.volumeButtons);
  const setVolumeButtons = useSettings((s) => s.setVolumeButtons);

  const active =
    isSupported &&
    enabled &&
    phase === "open" &&
    !demo &&
    serverCaps.includes("audio");

  useEffect(() => {
    if (!active) return;

    const removePress = addVolumeButtonListener((direction) => {
      sendMessage({ v: PROTOCOL_VERSION, t: "a.step", dir: direction });
    });
    // If the watcher cannot re-arm itself the buttons would half-work; turn the
    // setting off so the UI reflects reality instead of lying.
    const removeFailure = addUnavailableListener(() => {
      setVolumeButtons(false);
    });

    start().catch((error: unknown) => {
      // Nothing else can report this, and a silently dead button is the worst
      // outcome — surface it and let the toggle fall back to off.
      // eslint-disable-next-line no-console
      console.warn("[volume-buttons] could not start", error);
      setVolumeButtons(false);
    });

    return () => {
      removePress();
      removeFailure();
      void stop();
    };
  }, [active, setVolumeButtons]);
}
