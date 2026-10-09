import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { syncPointerConfig } from '@/features/trackpad/uplink';

const LANDSCAPE_KEY = 'entangle.settings.landscape';

interface SettingsState {
  pointerSensitivity: number;
  naturalScroll: boolean;
  /** Opt-in: lets the Trackpad tab rotate with the phone. Off by default. */
  landscape: boolean;
  setPointerSensitivity: (value: number) => void;
  setNaturalScroll: (value: boolean) => void;
  setLandscape: (value: boolean) => void;
}

export const usePointerSensitivityRef = { current: 1.5 };
export const useNaturalScrollRef = { current: true };

export const useSettings = create<SettingsState>((set) => ({
  pointerSensitivity: 1.5,
  naturalScroll: true,
  landscape: false,
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
  setLandscape: (value) => {
    set({ landscape: value });
    AsyncStorage.setItem(LANDSCAPE_KEY, value ? '1' : '0').catch(() => undefined);
  },
}));

AsyncStorage.getItem(LANDSCAPE_KEY)
  .then((raw) => {
    if (raw === '1') useSettings.setState({ landscape: true });
  })
  .catch(() => undefined);
