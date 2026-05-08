import { create } from 'zustand';

import EntangleServer, {
  type AccessibilityChangedEvent,
  type ClientConnectedEvent,
  type ClientDisconnectedEvent,
  type PairingStartedEvent,
  type PairingWindow,
  type ServerErrorEvent,
  type ServerMessageEvent,
  type ServerReadyEvent,
  eventEmitter,
} from 'entangle-server';
import { decode, encode, PROTOCOL_VERSION } from '@entangle/protocol';
import type { Message, WelcomeMessage } from '@entangle/protocol';

export type ClientInfo = {
  id: string;
  host: string;
  connectedAt: number;
  lastMessageAt: number;
  messageCount: number;
  inboundSinceTick: number;
  messageRate: number;
};

type ServerPhase = 'idle' | 'starting' | 'running' | 'paused' | 'error';

const SPARKLINE_LENGTH = 16;

interface ServerState {
  phase: ServerPhase;
  port: number | null;
  serviceName: string | null;
  lanHost: string | null;
  clients: Record<string, ClientInfo>;
  lastError: string | null;
  messageRate: number;
  rateHistory: number[];
  startedAt: number | null;
  uptimeSeconds: number;
  accessibilityTrusted: boolean;
  pairing: PairingWindow | null;
  /** Persisted user-given names keyed by remote host (IP). */
  clientNames: Record<string, string>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  requestAccessibility: () => Promise<boolean>;
  startPairing: () => Promise<void>;
  stopPairing: () => Promise<void>;
  forgetAllPaired: () => Promise<void>;
  disconnectClient: (id: string) => Promise<void>;
  forgetClient: (id: string) => Promise<void>;
  renameClient: (id: string, name: string | null) => Promise<void>;
}

let inboundSinceTick = 0;
let rateTimer: ReturnType<typeof setInterval> | null = null;

export const useServerStore = create<ServerState>((set, get) => ({
  phase: 'idle',
  port: null,
  serviceName: null,
  lanHost: EntangleServer.getLanHost(),
  clients: {},
  lastError: null,
  messageRate: 0,
  rateHistory: Array(SPARKLINE_LENGTH).fill(0),
  startedAt: null,
  uptimeSeconds: 0,
  accessibilityTrusted: EntangleServer.isAccessibilityTrusted(),
  pairing: null,
  clientNames: EntangleServer.getClientNames(),
  requestAccessibility: async () => {
    const trusted = await EntangleServer.promptAccessibility();
    set({ accessibilityTrusted: trusted });
    return trusted;
  },
  startPairing: async () => {
    const window = await EntangleServer.startPairing();
    set({ pairing: window });
  },
  stopPairing: async () => {
    await EntangleServer.stopPairing();
    set({ pairing: null });
  },
  forgetAllPaired: async () => {
    await EntangleServer.forgetAllPaired();
    set({ clients: {}, clientNames: {} });
  },
  disconnectClient: async (id: string) => {
    await EntangleServer.disconnectClient(id);
    // The native module emits clientDisconnected which prunes the entry.
  },
  forgetClient: async (id: string) => {
    const host = get().clients[id]?.host;
    await EntangleServer.forgetClient(id);
    if (host) {
      const next = { ...get().clientNames };
      delete next[normalizeHost(host)];
      set({ clientNames: next });
    }
  },
  renameClient: async (id: string, name: string | null) => {
    const host = get().clients[id]?.host;
    if (!host) return;
    const trimmed = name?.trim() || null;
    await EntangleServer.setClientName(host, trimmed);
    const key = normalizeHost(host);
    const next = { ...get().clientNames };
    if (trimmed) next[key] = trimmed;
    else delete next[key];
    set({ clientNames: next });
  },
  start: async () => {
    if (get().phase === 'starting' || get().phase === 'running') return;
    set({ phase: 'starting', lastError: null });
    try {
      const { port, serviceName, lanHost } = await EntangleServer.startServer();
      set({
        phase: 'running',
        port,
        serviceName,
        lanHost: lanHost ?? EntangleServer.getLanHost(),
        startedAt: Date.now(),
      });
      if (!rateTimer) {
        rateTimer = setInterval(tickStats, 1000);
      }
    } catch (error: any) {
      set({ phase: 'error', lastError: error?.message ?? String(error) });
    }
  },
  stop: async () => {
    await EntangleServer.stopServer();
    if (rateTimer) {
      clearInterval(rateTimer);
      rateTimer = null;
    }
    set({
      phase: 'paused',
      port: null,
      serviceName: null,
      clients: {},
      messageRate: 0,
      rateHistory: Array(SPARKLINE_LENGTH).fill(0),
      startedAt: null,
      uptimeSeconds: 0,
    });
  },
}));

function tickStats() {
  useServerStore.setState((state) => {
    const tick = inboundSinceTick;
    inboundSinceTick = 0;
    const history = [...state.rateHistory.slice(1), tick];
    const startedAt = state.startedAt;
    const uptimeSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    const clients: Record<string, ClientInfo> = {};
    for (const [id, c] of Object.entries(state.clients)) {
      clients[id] = {
        ...c,
        messageRate: c.inboundSinceTick,
        inboundSinceTick: 0,
      };
    }
    return { messageRate: tick, rateHistory: history, uptimeSeconds, clients };
  });
}

/** Strip the trailing `:port` so we key by IP/hostname only — must match
 * `PairingManager.normalize(host:)` on the Swift side. */
export function normalizeHost(host: string): string {
  const colon = host.lastIndexOf(':');
  return colon >= 0 ? host.slice(0, colon) : host;
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH === 0 ? `${d}d` : `${d}d ${remH}h`;
}

eventEmitter.addListener('clientConnected', (event: ClientConnectedEvent) => {
  const now = Date.now();
  useServerStore.setState((state) => ({
    clients: {
      ...state.clients,
      [event.id]: {
        id: event.id,
        host: event.host,
        connectedAt: now,
        lastMessageAt: now,
        messageCount: 0,
        inboundSinceTick: 0,
        messageRate: 0,
      },
    },
  }));
  sendWelcome(event.id);
});

eventEmitter.addListener('clientDisconnected', (event: ClientDisconnectedEvent) => {
  useServerStore.setState((state) => {
    const next = { ...state.clients };
    delete next[event.id];
    return { clients: next };
  });
});

eventEmitter.addListener('message', (event: ServerMessageEvent) => {
  inboundSinceTick += 1;
  const msg = decode(event.text);
  useServerStore.setState((state) => {
    const existing = state.clients[event.id];
    if (!existing) return state;
    return {
      clients: {
        ...state.clients,
        [event.id]: {
          ...existing,
          lastMessageAt: Date.now(),
          messageCount: existing.messageCount + 1,
          inboundSinceTick: existing.inboundSinceTick + 1,
        },
      },
    };
  });
  if (!msg) return;
  handleMessage(event.id, msg);
});

eventEmitter.addListener('error', (event: ServerErrorEvent) => {
  useServerStore.setState({ lastError: event.message });
});

eventEmitter.addListener('serverReady', (event: ServerReadyEvent) => {
  useServerStore.setState((state) => ({
    port: event.port,
    serviceName: event.serviceName,
    lanHost: event.lanHost ?? state.lanHost,
    phase: 'running',
    startedAt: state.startedAt ?? Date.now(),
  }));
});

eventEmitter.addListener('accessibilityChanged', (event: AccessibilityChangedEvent) => {
  useServerStore.setState({ accessibilityTrusted: event.trusted });
});

eventEmitter.addListener('pairingStarted', (event: PairingStartedEvent) => {
  useServerStore.setState({ pairing: event });
});

eventEmitter.addListener('pairingStopped', () => {
  useServerStore.setState({ pairing: null });
});

eventEmitter.addListener('pairingExpired', () => {
  useServerStore.setState({ pairing: null });
});

function handleMessage(clientId: string, msg: Message) {
  switch (msg.t) {
    case 'hello':
      sendWelcome(clientId);
      return;
    case 'ping':
      EntangleServer.sendToClient(clientId, encode({ v: PROTOCOL_VERSION, t: 'pong', id: msg.id }));
      return;
    default:
      // Phases B–F handle the rest; for now we just log via the store counters.
      return;
  }
}

function sendWelcome(clientId: string) {
  const { serviceName, port } = useServerStore.getState();
  const welcome: WelcomeMessage = {
    v: PROTOCOL_VERSION,
    t: 'welcome',
    server: {
      name: serviceName ?? 'entangle',
      version: '0.0.1',
      host: serviceName ?? '',
    },
    caps: ['pointer', 'scroll', 'keyboard', 'dock', 'gestures'],
  };
  if (port != null) {
    EntangleServer.sendToClient(clientId, encode(welcome));
  }
}
