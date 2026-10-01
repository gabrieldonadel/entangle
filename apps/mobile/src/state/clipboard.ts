import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { create } from 'zustand';

import {
  CLIPBOARD_MAX_IMAGE_BYTES,
  CLIPBOARD_MAX_IMAGE_EDGE,
  PROTOCOL_VERSION,
  type ClipboardPushMessage,
} from '@entangle/protocol';

import { sendMessage } from '@/net/send';

const STORAGE_KEY = 'entangle.clipboardSync';

interface ClipboardState {
  /** Local preference: user wants auto sync when the Mac offers the cap. */
  enabled: boolean;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
  hydrate: () => Promise<void>;
  /** Call after welcome / when connection opens with the current caps. */
  syncWithSession: (opts: { connected: boolean; hasCap: boolean }) => void;
  applyRemote: (msg: ClipboardPushMessage) => void;
  stop: () => void;
}

let localGen = 0;
/** Ignore the next clipboard listener firings after applying a remote push. */
let suppressListenerEvents = 0;
let subscription: { remove: () => void } | null = null;
let sessionActive = false;

function stripDataUrl(data: string): string {
  const idx = data.indexOf('base64,');
  return idx >= 0 ? data.slice(idx + 'base64,'.length) : data;
}

function approxDecodedBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

async function readLocalPayload(): Promise<ClipboardPushMessage | null> {
  if (await Clipboard.hasImageAsync()) {
    const img = await Clipboard.getImageAsync({ format: 'png' });
    if (img?.data) {
      const raw = stripDataUrl(img.data);
      const { width, height } = img.size;
      if (width > CLIPBOARD_MAX_IMAGE_EDGE || height > CLIPBOARD_MAX_IMAGE_EDGE) {
        return null;
      }
      if (approxDecodedBytes(raw) > CLIPBOARD_MAX_IMAGE_BYTES) {
        return null;
      }
      localGen += 1;
      return {
        v: PROTOCOL_VERSION,
        t: 'cb.push',
        kind: 'image',
        imagePng: raw,
        gen: localGen,
      };
    }
  }

  const text = await Clipboard.getStringAsync();
  localGen += 1;
  if (!text) {
    return {
      v: PROTOCOL_VERSION,
      t: 'cb.push',
      kind: 'empty',
      gen: localGen,
    };
  }
  return {
    v: PROTOCOL_VERSION,
    t: 'cb.push',
    kind: 'text',
    text,
    gen: localGen,
  };
}

async function writeRemote(msg: ClipboardPushMessage): Promise<void> {
  // Re-encoded images rarely match what we wrote; skip the next listener bumps.
  suppressListenerEvents = 2;
  try {
    switch (msg.kind) {
      case 'text':
        await Clipboard.setStringAsync(msg.text ?? '');
        break;
      case 'image':
        if (msg.imagePng) {
          await Clipboard.setImageAsync(msg.imagePng);
        }
        break;
      case 'empty':
        await Clipboard.setStringAsync('');
        break;
    }
  } catch {
    suppressListenerEvents = 0;
  }
}

async function onLocalClipboardChange() {
  if (!sessionActive) return;
  if (suppressListenerEvents > 0) {
    suppressListenerEvents -= 1;
    return;
  }
  const payload = await readLocalPayload();
  if (!payload) return;
  sendMessage(payload);
}

function startListening() {
  if (subscription) return;
  subscription = Clipboard.addClipboardListener(() => {
    void onLocalClipboardChange();
  });
}

function stopListening() {
  subscription?.remove();
  subscription = null;
}

function sendSync(on: boolean) {
  sendMessage({ v: PROTOCOL_VERSION, t: 'cb.sync', on });
}

function activateSession() {
  if (sessionActive) return;
  sessionActive = true;
  sendSync(true);
  startListening();
}

function deactivateSession() {
  if (!sessionActive) return;
  sessionActive = false;
  sendSync(false);
  stopListening();
}

export const useClipboard = create<ClipboardState>((set, get) => ({
  enabled: false,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const enabled = raw === '1';
      set({ enabled, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
    // Welcome may have arrived before storage finished loading.
    void import('./connection').then(({ useConnection }) => {
      const { phase, serverCaps } = useConnection.getState();
      get().syncWithSession({
        connected: phase === 'open',
        hasCap: serverCaps.includes('clipboard'),
      });
    });
  },
  setEnabled: (enabled) => {
    set({ enabled });
    void AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    // Import lazily to avoid a circular init edge with connection.ts.
    void import('./connection').then(({ useConnection }) => {
      const { phase, serverCaps } = useConnection.getState();
      get().syncWithSession({
        connected: phase === 'open',
        hasCap: serverCaps.includes('clipboard'),
      });
    });
  },
  syncWithSession: ({ connected, hasCap }) => {
    const { enabled } = get();
    if (connected && hasCap && enabled) {
      activateSession();
    } else {
      deactivateSession();
    }
  },
  applyRemote: (msg) => {
    if (!sessionActive) return;
    void writeRemote(msg);
  },
  stop: () => {
    deactivateSession();
  },
}));

/** Kick hydration once at module load. */
void useClipboard.getState().hydrate();
