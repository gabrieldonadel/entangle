import { create } from 'zustand';

interface SettingsState {
  pointerSensitivity: number;
  setPointerSensitivity: (value: number) => void;
}

export const usePointerSensitivityRef = { current: 1.5 };

export const useSettings = create<SettingsState>((set) => ({
  pointerSensitivity: 1.5,
  setPointerSensitivity: (value) => {
    usePointerSensitivityRef.current = value;
    set({ pointerSensitivity: value });
  },
}));
