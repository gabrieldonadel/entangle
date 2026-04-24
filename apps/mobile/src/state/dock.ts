import { create } from 'zustand';

import type { DockApp } from '@entangle/protocol';

interface DockState {
  apps: DockApp[];
  lastUpdatedAt: number | null;
  setApps: (apps: DockApp[]) => void;
  clear: () => void;
}

export const useDock = create<DockState>((set) => ({
  apps: [],
  lastUpdatedAt: null,
  setApps: (apps) => set({ apps, lastUpdatedAt: Date.now() }),
  clear: () => set({ apps: [], lastUpdatedAt: null }),
}));
