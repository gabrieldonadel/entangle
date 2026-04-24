import { create } from 'zustand';

interface SettingsState {
  pointerSensitivity: number;
  naturalScroll: boolean;
  setPointerSensitivity: (value: number) => void;
  setNaturalScroll: (value: boolean) => void;
}

export const usePointerSensitivityRef = { current: 1.5 };
export const useNaturalScrollRef = { current: true };

export const useSettings = create<SettingsState>((set) => ({
  pointerSensitivity: 1.5,
  naturalScroll: true,
  setPointerSensitivity: (value) => {
    usePointerSensitivityRef.current = value;
    set({ pointerSensitivity: value });
  },
  setNaturalScroll: (value) => {
    useNaturalScrollRef.current = value;
    set({ naturalScroll: value });
  },
}));
