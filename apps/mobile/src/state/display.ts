import { create } from 'zustand';

/** How long a wake request stays "pending" before the button is live again. */
const WAKE_TIMEOUT_MS = 2500;

interface DisplayState {
  /** True while the Mac's screen is asleep. */
  asleep: boolean;
  /** False until the Mac has told us the real state. */
  synced: boolean;
  /**
   * True between sending `sys.wake` and the Mac reporting the screen awake.
   * Keeps the overlay from firing a burst of wakes on repeated taps.
   */
  waking: boolean;
  applyRemote: (asleep: boolean) => void;
  markWaking: () => void;
  reset: () => void;
}

let wakeTimer: ReturnType<typeof setTimeout> | null = null;

export const useDisplay = create<DisplayState>((set) => ({
  asleep: false,
  synced: false,
  waking: false,
  applyRemote: (asleep) => {
    clearWakeTimer();
    set({ asleep, synced: true, waking: false });
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
  reset: () => {
    clearWakeTimer();
    set({ asleep: false, synced: false, waking: false });
  },
}));

function clearWakeTimer() {
  if (wakeTimer) {
    clearTimeout(wakeTimer);
    wakeTimer = null;
  }
}
