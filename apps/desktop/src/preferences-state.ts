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

const raw = EntangleServer.getPreferences();
const initial: Preferences = {
  cursorAllowPhones: false,
  cursorWorkspacePath: '',
  cursorWorkspaceAllowlist: [],
  cursorModel: 'composer-2.5',
  cursorHasApiKey: false,
  cursorReady: false,
  clipboardSync: false,
  ...raw,
};

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

/** Pref keys that change which caps / icons the phone sees in `welcome`. */
const WELCOME_CAP_KEYS: (keyof Preferences)[] = [
  'cursorAllowPhones',
  'cursorWorkspacePath',
  'cursorWorkspaceAllowlist',
  'cursorHasApiKey',
  'cursorReady',
  'clipboardSync',
];

eventEmitter.addListener('preferencesChanged', (event: PreferencesChangedEvent) => {
  const prev = usePreferencesStore.getState();
  usePreferencesStore.setState(event);
  const capsChanged = WELCOME_CAP_KEYS.some((key) => prev[key] !== event[key]);
  if (!capsChanged) return;
  // Lazy import to avoid a circular init edge with server-state.
  void import('./server-state').then((mod) => {
    mod.refreshWelcomeCaps?.();
  });
});
