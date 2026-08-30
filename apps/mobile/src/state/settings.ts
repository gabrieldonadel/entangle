import { create } from 'zustand';

interface SettingsState {
  pointerSensitivity: number;
  naturalScroll: boolean;
  /**
   * Send the phone's hardware volume buttons to the Mac. While on, the phone's
   * own volume is taken over: it moves as you press, and it is pushed back to
   * the middle when it reaches an end.
   */
  volumeButtons: boolean;
  setPointerSensitivity: (value: number) => void;
  setNaturalScroll: (value: boolean) => void;
  setVolumeButtons: (value: boolean) => void;
}

export const usePointerSensitivityRef = { current: 1.5 };
export const useNaturalScrollRef = { current: true };

export const useSettings = create<SettingsState>((set) => ({
  pointerSensitivity: 1.5,
  naturalScroll: true,
  volumeButtons: true,
  setPointerSensitivity: (value) => {
    usePointerSensitivityRef.current = value;
    set({ pointerSensitivity: value });
  },
  setNaturalScroll: (value) => {
    useNaturalScrollRef.current = value;
    set({ naturalScroll: value });
  },
  setVolumeButtons: (value) => set({ volumeButtons: value }),
}));
