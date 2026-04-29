import { create } from 'zustand';

import EntangleServer, {
  type Preferences,
  type PreferencesChangedEvent,
  eventEmitter,
} from 'entangle-server';

interface PreferencesState extends Preferences {
  hydrated: boolean;
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void>;
  patch: (next: Partial<Preferences>) => Promise<void>;
}

const initial: Preferences = EntangleServer.getPreferences();

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...initial,
  hydrated: true,
  set: async (key, value) => {
    set({ [key]: value } as Partial<PreferencesState>);
    const next = await EntangleServer.setPreferences({ [key]: value } as Partial<Preferences>);
    set(next);
  },
  patch: async (next) => {
    const merged = { ...get(), ...next } as Preferences;
    set(next as Partial<PreferencesState>);
    const applied = await EntangleServer.setPreferences(next);
    set(applied);
    return void merged;
  },
}));

eventEmitter.addListener('preferencesChanged', (event: PreferencesChangedEvent) => {
  usePreferencesStore.setState(event);
});
