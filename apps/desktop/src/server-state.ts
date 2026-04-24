import { create } from 'zustand';

import EntangleServer, {
  type AccessibilityChangedEvent,
  type ClientConnectedEvent,
  type ClientDisconnectedEvent,
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
};

type ServerPhase = 'idle' | 'starting' | 'running' | 'error';

interface ServerState {
  phase: ServerPhase;
  port: number | null;
  serviceName: string | null;
  clients: Record<string, ClientInfo>;
  lastError: string | null;
  messageRate: number;
  accessibilityTrusted: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  requestAccessibility: () => Promise<boolean>;
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
  accessibilityTrusted: EntangleServer.isAccessibilityTrusted(),
  requestAccessibility: async () => {
    const trusted = await EntangleServer.promptAccessibility();
    set({ accessibilityTrusted: trusted });
    return trusted;
  },
  start: async () => {
    if (get().phase === 'starting' || get().phase === 'running') return;
    set({ phase: 'starting', lastError: null });
    try {
      const { port, serviceName } = await EntangleServer.startServer();
      set({ phase: 'running', port, serviceName });
      if (!rateTimer) {
        rateTimer = setInterval(() => {
          set({ messageRate: inboundSinceTick });
          inboundSinceTick = 0;
        }, 1000);
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
    set({ phase: 'idle', port: null, serviceName: null, clients: {}, messageRate: 0 });
  },
}));

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
  useServerStore.setState({ port: event.port, serviceName: event.serviceName, phase: 'running' });
});

eventEmitter.addListener('accessibilityChanged', (event: AccessibilityChangedEvent) => {
  useServerStore.setState({ accessibilityTrusted: event.trusted });
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
