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

type ServerPhase = 'idle' | 'starting' | 'running' | 'error';

const SPARKLINE_LENGTH = 16;

interface ServerState {
  phase: ServerPhase;
  port: number | null;
  serviceName: string | null;
  clients: Record<string, ClientInfo>;
  lastError: string | null;
  messageRate: number;
  rateHistory: number[];
  startedAt: number | null;
  uptimeSeconds: number;
  accessibilityTrusted: boolean;
  pairing: PairingWindow | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  requestAccessibility: () => Promise<boolean>;
  startPairing: () => Promise<void>;
  stopPairing: () => Promise<void>;
  forgetAllPaired: () => Promise<void>;
}

let inboundSinceTick = 0;
let rateTimer: ReturnType<typeof setInterval> | null = null;

export const useServerStore = create<ServerState>((set, get) => ({
  phase: 'idle',
  port: null,
  serviceName: null,
  clients: {},
  lastError: null,
  messageRate: 0,
  rateHistory: Array(SPARKLINE_LENGTH).fill(0),
  startedAt: null,
  uptimeSeconds: 0,
  accessibilityTrusted: EntangleServer.isAccessibilityTrusted(),
  pairing: null,
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
    set({ clients: {} });
  },
  start: async () => {
    if (get().phase === 'starting' || get().phase === 'running') return;
    set({ phase: 'starting', lastError: null });
    try {
      const { port, serviceName } = await EntangleServer.startServer();
      set({ phase: 'running', port, serviceName, startedAt: Date.now() });
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
      phase: 'idle',
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
