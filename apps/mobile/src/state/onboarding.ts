import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const STORAGE_KEY = "entangle.onboardingComplete";

interface OnboardingState {
  completed: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  markComplete: () => Promise<void>;
  reset: () => Promise<void>;
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  completed: false,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      set({ completed: raw === "1", hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  markComplete: async () => {
    set({ completed: true });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  },
  reset: async () => {
    set({ completed: false });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
}));
