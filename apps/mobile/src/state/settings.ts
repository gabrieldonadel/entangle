import { create } from 'zustand';

import { syncPointerConfig } from '@/features/trackpad/uplink';

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
    // The uplink scales on the UI thread, where it cannot read this store.
    syncPointerConfig({ sensitivity: value });
    set({ pointerSensitivity: value });
  },
  setNaturalScroll: (value) => {
    useNaturalScrollRef.current = value;
    set({ naturalScroll: value });
  },
}));
