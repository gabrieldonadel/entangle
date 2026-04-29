import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

import {
  decode,
  encode,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  PROTOCOL_VERSION,
  isDockListResponse,
  isDockUpdate,
} from '@entangle/protocol';
import type { ClientMessage, DockApp, Message } from '@entangle/protocol';

import { useDock } from './dock';

export type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'pairing';

const TRUSTED_TOKENS_KEY = 'entangle.trustedTokens';

export interface ConnectionTarget {
  name: string;
  host: string;
  port: number;
}

interface ConnectionState {
  phase: ConnectionPhase;
  target: ConnectionTarget | null;
  serverName: string | null;
  serverVersion: string | null;
  serverCaps: string[];
  lastError: string | null;
  latencyMs: number | null;
  pairingError: string | null;
  trustedTokens: Record<string, string>;
  connect: (target: ConnectionTarget) => void;
  disconnect: () => void;
  send: (msg: ClientMessage) => void;
  sendRaw: (raw: string) => void;
  retryPairing: (code?: string) => void;
}

let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pongTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let pingId = 0;
let pingSentAt = 0;
let manuallyDisconnected = false;
let pendingPairCode: string | null = null;
let pendingPairToken: string | null = null;

export const useConnection = create<ConnectionState>((set, get) => ({
  phase: 'idle',
  target: null,
  serverName: null,
  serverVersion: null,
  serverCaps: [],
  lastError: null,
  latencyMs: null,
  pairingError: null,
  trustedTokens: {},
  connect: (target) => {
    manuallyDisconnected = false;
    reconnectAttempt = 0;
    pendingPairCode = null;
    pendingPairToken = get().trustedTokens[target.host] ?? null;
    set({ target, lastError: null, pairingError: null });
    openSocket();
  },
  disconnect: () => {
    manuallyDisconnected = true;
    pendingPairCode = null;
    pendingPairToken = null;
    clearTimers();
    if (socket) {
      try {
        socket.close();
      } catch {}
      socket = null;
    }
    useDock.getState().clear();
    set({
      phase: 'idle',
      target: null,
      serverName: null,
      serverVersion: null,
      serverCaps: [],
      latencyMs: null,
      pairingError: null,
    });
  },
  send: (msg) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(encode(msg));
    }
  },
  sendRaw: (raw) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
    }
  },
  retryPairing: (code) => {
    if (code && code.trim().length > 0) {
      pendingPairCode = code.trim();
    } else {
      pendingPairCode = null;
    }
    pendingPairToken = null;
    reconnectAttempt = 0;
    manuallyDisconnected = false;
    set({ pairingError: null });
    openSocket();
  },
}));

function openSocket() {
  const { target } = useConnection.getState();
  if (!target) return;
  clearTimers();

  useConnection.setState({
    phase: reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
  });

  const ws = new WebSocket(`ws://${target.host}:${target.port}`);
  socket = ws;

  ws.onopen = () => {
    reconnectAttempt = 0;
    useConnection.setState({ phase: 'open', lastError: null });
    if (pendingPairToken) {
      ws.send(encode({ v: PROTOCOL_VERSION, t: 'pair.qr', token: pendingPairToken }));
    } else if (pendingPairCode) {
      ws.send(encode({ v: PROTOCOL_VERSION, t: 'pair.request', code: pendingPairCode }));
    }
    const hello: ClientMessage = {
      v: PROTOCOL_VERSION,
      t: 'hello',
      client: {
        name: 'phone',
        platform: 'ios',
        version: '0.0.1',
      },
    };
    ws.send(encode(hello));
    startHeartbeat();
  };

  ws.onmessage = (event) => {
    const msg = decode(typeof event.data === 'string' ? event.data : '');
    if (!msg) return;
    handleMessage(msg);
  };

  ws.onerror = () => {
    useConnection.setState({ lastError: 'WebSocket error' });
  };

  ws.onclose = () => {
    socket = null;
    clearTimers();
    if (manuallyDisconnected) return;
    if (useConnection.getState().phase === 'pairing') return;
    scheduleReconnect();
  };
}

function handleMessage(msg: Message) {
  if (isDockListResponse(msg)) {
    useDock.getState().setApps(msg.apps);
    return;
  }
  if (isDockUpdate(msg)) {
    applyDockUpdate(msg);
    return;
  }
  switch (msg.t) {
    case 'welcome':
      useConnection.setState({
        serverName: msg.server.name,
        serverVersion: msg.server.version,
        serverCaps: msg.caps,
      });
      return;
    case 'pong':
      if (pongTimeout) {
        clearTimeout(pongTimeout);
        pongTimeout = null;
      }
      if (pingSentAt > 0) {
        useConnection.setState({ latencyMs: Date.now() - pingSentAt });
      }
      return;
    case 'pair.accepted': {
      const { target, trustedTokens } = useConnection.getState();
      if (target && pendingPairToken) {
        const next = { ...trustedTokens, [target.host]: pendingPairToken };
        useConnection.setState({ trustedTokens: next });
        void persistTrustedTokens(next);
      }
      pendingPairCode = null;
      useConnection.setState({ pairingError: null });
      return;
    }
    case 'pair.rejected': {
      pendingPairCode = null;
      pendingPairToken = null;
      const { target, trustedTokens } = useConnection.getState();
      if (target && trustedTokens[target.host]) {
        const next = { ...trustedTokens };
        delete next[target.host];
        useConnection.setState({ trustedTokens: next });
        void persistTrustedTokens(next);
      }
      reconnectAttempt = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      useConnection.setState({
        phase: 'pairing',
        pairingError: msg.reason || null,
      });
      try {
        socket?.close();
      } catch {}
      return;
    }
    default:
      return;
  }
}

function applyDockUpdate(msg: {
  added?: DockApp[];
  removed?: string[];
  changed?: Partial<DockApp>[];
}) {
  const { apps } = useDock.getState();
  const byId = new Map(apps.map((app) => [app.bundleId, app]));
  for (const bundleId of msg.removed ?? []) byId.delete(bundleId);
  for (const app of msg.added ?? []) byId.set(app.bundleId, app);
  for (const change of msg.changed ?? []) {
    if (!change.bundleId) continue;
    const existing = byId.get(change.bundleId);
    if (existing) byId.set(change.bundleId, { ...existing, ...change } as DockApp);
  }
  useDock.getState().setApps(Array.from(byId.values()));
}

function startHeartbeat() {
  clearInterval(pingTimer ?? undefined);
  pingTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    pingId += 1;
    pingSentAt = Date.now();
    socket.send(encode({ v: PROTOCOL_VERSION, t: 'ping', id: pingId }));
    if (pongTimeout) clearTimeout(pongTimeout);
    pongTimeout = setTimeout(() => {
      try {
        socket?.close();
      } catch {}
    }, HEARTBEAT_TIMEOUT_MS);
  }, HEARTBEAT_INTERVAL_MS);
}

function scheduleReconnect() {
  const delay = Math.min(8000, 1000 * Math.pow(2, reconnectAttempt));
  reconnectAttempt += 1;
  useConnection.setState({ phase: 'reconnecting' });
  reconnectTimer = setTimeout(openSocket, delay);
}

function clearTimers() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (pongTimeout) {
    clearTimeout(pongTimeout);
    pongTimeout = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

export function getSocket(): WebSocket | null {
  return socket;
}

export function hasUserDisconnected(): boolean {
  return manuallyDisconnected;
}

async function persistTrustedTokens(tokens: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(TRUSTED_TOKENS_KEY, JSON.stringify(tokens));
  } catch {}
}

void (async () => {
  try {
    const raw = await AsyncStorage.getItem(TRUSTED_TOKENS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed && typeof parsed === 'object') {
      useConnection.setState({ trustedTokens: parsed });
    }
  } catch {}
})();

NetInfo.addEventListener((state) => {
  if (!state.isConnected) return;
  const { phase, target } = useConnection.getState();
  if (!target) return;
  if (phase !== 'reconnecting' && phase !== 'closed') return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  openSocket();
});
