import { create } from 'zustand';

import { ModFlags } from '@entangle/protocol';
import type { ModMask } from '@entangle/protocol';

interface ModifierState {
  mask: ModMask;
  toggle: (bit: ModMask) => void;
  consume: () => ModMask;
  clear: () => void;
}

export const useModifiers = create<ModifierState>((set, get) => ({
  mask: ModFlags.None,
  toggle: (bit) => set((state) => ({ mask: state.mask ^ bit })),
  consume: () => {
    const current = get().mask;
    if (current !== ModFlags.None) {
      set({ mask: ModFlags.None });
    }
    return current;
  },
  clear: () => set({ mask: ModFlags.None }),
}));
