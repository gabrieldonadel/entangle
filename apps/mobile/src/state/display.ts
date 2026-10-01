import { create } from 'zustand';

/** How long a wake request stays "pending" before the button is live again. */
const WAKE_TIMEOUT_MS = 2500;

/**
 * How long to wait for the Mac to report itself unlocked before treating the
 * password as rejected. Generous: the lock screen takes a moment to accept a
 * password, and claiming failure on a correct one is the worse mistake.
 */
const UNLOCK_TIMEOUT_MS = 4000;

interface DisplayState {
  /** True while the Mac's screen is asleep. */
  asleep: boolean;
  /**
   * True while the Mac sits on its lock screen. Stays false for Macs without
   * the `lock` cap, which never report it.
   */
  locked: boolean;
  /** False until the Mac has told us the real state. */
  synced: boolean;
  /**
   * True between sending `sys.wake` and the Mac reporting the screen awake.
   * Keeps the overlay from firing a burst of wakes on repeated taps.
   */
  waking: boolean;
  /** True between sending `sys.unlock` and the Mac reporting itself unlocked. */
  unlocking: boolean;
  /**
   * True when an unlock attempt ran out of time with the Mac still locked —
   * which in practice means the password was wrong.
   */
  unlockFailed: boolean;
  applyRemote: (asleep: boolean, locked: boolean) => void;
  markWaking: () => void;
  markUnlocking: () => void;
  reset: () => void;
}

let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let unlockTimer: ReturnType<typeof setTimeout> | null = null;

export const useDisplay = create<DisplayState>((set) => ({
  asleep: false,
  locked: false,
  synced: false,
  waking: false,
  unlocking: false,
  unlockFailed: false,
  applyRemote: (asleep, locked) => {
    clearWakeTimer();
    // A Mac that reports itself unlocked has answered the only question the
    // pending attempt was asking, so clear the failure too.
    if (!locked) clearUnlockTimer();
    set({
      asleep,
      locked,
      synced: true,
      waking: false,
      ...(locked ? null : { unlocking: false, unlockFailed: false }),
    });
  },
  markWaking: () => {
    clearWakeTimer();
    // The Mac normally answers with `state.display` in well under a second.
    // If the packet is lost, fall back to a live button rather than a spinner
    // that never stops.
    wakeTimer = setTimeout(() => {
      wakeTimer = null;
      useDisplay.setState({ waking: false });
    }, WAKE_TIMEOUT_MS);
    set({ waking: true });
  },
  markUnlocking: () => {
    clearUnlockTimer();
    unlockTimer = setTimeout(() => {
      unlockTimer = null;
      useDisplay.setState({ unlocking: false, unlockFailed: true });
    }, UNLOCK_TIMEOUT_MS);
    set({ unlocking: true, unlockFailed: false });
  },
  reset: () => {
    clearWakeTimer();
    clearUnlockTimer();
    set({
      asleep: false,
      locked: false,
      synced: false,
      waking: false,
      unlocking: false,
      unlockFailed: false,
    });
  },
}));

function clearWakeTimer() {
  if (wakeTimer) {
    clearTimeout(wakeTimer);
    wakeTimer = null;
  }
}

function clearUnlockTimer() {
  if (unlockTimer) {
    clearTimeout(unlockTimer);
    unlockTimer = null;
  }
}
