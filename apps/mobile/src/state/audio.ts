import { create } from 'zustand';

interface AudioState {
  /** Output level of the Mac, 0…1. */
  level: number;
  muted: boolean;
  /** False until the Mac has told us its real level. */
  synced: boolean;
  /**
   * True while the user drags the slider. Incoming `state.audio` is ignored for
   * the duration — the Mac echoes every write back, and applying those echoes
   * mid-drag makes the knob stutter against the finger.
   */
  dragging: boolean;
  applyRemote: (level: number, muted: boolean) => void;
  setLocalLevel: (level: number) => void;
  setDragging: (dragging: boolean) => void;
  reset: () => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  level: 0.5,
  muted: false,
  synced: false,
  dragging: false,
  applyRemote: (level, muted) => {
    if (get().dragging) {
      // Still record the mute state; only the level fights with the finger.
      set({ muted, synced: true });
      return;
    }
    set({ level: clamp(level), muted, synced: true });
  },
  setLocalLevel: (level) => set({ level: clamp(level) }),
  setDragging: (dragging) => set({ dragging }),
  reset: () => set({ level: 0.5, muted: false, synced: false, dragging: false }),
}));

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
