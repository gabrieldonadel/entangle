import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
  decode,
  encode,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  PROTOCOL_VERSION,
  isAudioState,
  isDiagState,
  isUdpOk,
  isDisplayState,
  isDockListResponse,
  isDockUpdate,
} from '@entangle/protocol';
import type { ClientMessage, DockApp, Message } from '@entangle/protocol';

import { drainPointerCounters, syncPointerConfig } from '@/features/trackpad/uplink';
import * as udp from '@/net/udp';

import { useAudio } from './audio';
import { recordRtt, tickPhoneStats, useDiag } from './diag';
import { useDisplay } from './display';
import { useDock } from './dock';
import { DEMO_DOCK_APPS } from './demo';

export type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'pairing';

const TRUSTED_TOKENS_KEY = 'entangle.trustedTokens';

/**
 * How long a socket may sit in CONNECTING before we give up on it.
 *
 * A WebSocket opened against a host iOS cannot resolve (a stale `.local.`
 * name, a scoped IPv6 literal) never fires `onopen`, `onerror` or `onclose`.
 * Without this timeout the phase stays `connecting` forever, which makes the
 * whole discovery list untappable with no way back.
 */
const CONNECT_TIMEOUT_MS = 8000;

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
  demo: boolean;
  connect: (target: ConnectionTarget) => void;
  connectWithToken: (input: {
    name?: string;
    host: string;
    port: number;
    token: string;
  }) => void;
  disconnect: () => void;
  enterDemo: () => void;
  send: (msg: ClientMessage) => void;
  sendRaw: (raw: string) => void;
  retryPairing: (code?: string) => void;
}

let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pongTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connectTimeout: ReturnType<typeof setTimeout> | null = null;
let diagPingTimer: ReturnType<typeof setInterval> | null = null;
let diagReportTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempt = 0;
let pingId = 0;
/** Ping id → send time. Matching the pong by id keeps the round-trip figure
 *  honest when diagnostics add pings of their own. */
const pendingPings = new Map<number, number>();
/** The id of the ping the heartbeat timeout is currently waiting on. */
let heartbeatPingId = 0;
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
  demo: false,
  connect: (target) => {
    if (get().demo) return;
    manuallyDisconnected = false;
    reconnectAttempt = 0;
    pendingPairCode = null;
    pendingPairToken = get().trustedTokens[target.host] ?? null;
    set({ target, lastError: null, pairingError: null });
    openSocket();
  },
  connectWithToken: ({ name, host, port, token }) => {
    if (get().demo) return;
    manuallyDisconnected = false;
    reconnectAttempt = 0;
    pendingPairCode = null;
    pendingPairToken = token;
    const target: ConnectionTarget = { name: name ?? host, host, port };
    AsyncStorage.setItem('entangle.lastHost', JSON.stringify(target)).catch(
      () => undefined,
    );
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
    useAudio.getState().reset();
    useDisplay.getState().reset();
    useDiag.getState().reset();
    udp.reset();
    syncPointerConfig({ datagramToken: '', diagEnabled: false });
    set({
      phase: 'idle',
      target: null,
      serverName: null,
      serverVersion: null,
      serverCaps: [],
      latencyMs: null,
      pairingError: null,
      demo: false,
    });
  },
  enterDemo: () => {
    manuallyDisconnected = false;
    reconnectAttempt = 0;
    pendingPairCode = null;
    pendingPairToken = null;
    clearTimers();
    if (socket) {
      try {
        socket.close();
      } catch {}
      socket = null;
    }
    useDock.getState().setApps(DEMO_DOCK_APPS);
    // Demo mode has no Mac to report a level, so seed one the slider can move.
    useAudio.getState().applyRemote(0.45, false);
    useDisplay.getState().reset();
    set({
      phase: 'open',
      target: { name: 'Demo Mac', host: '0.0.0.0', port: 0 },
      serverName: 'Demo Mac',
      serverVersion: 'demo',
      serverCaps: [],
      lastError: null,
      latencyMs: null,
      pairingError: null,
      demo: true,
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
  const state = useConnection.getState();
  if (state.demo) return;
  const { target } = state;
  if (!target) return;
  clearTimers();

  useConnection.setState({
    phase: reconnectAttempt > 0 ? 'reconnecting' : 'connecting',
  });

  const ws = new WebSocket(`ws://${target.host}:${target.port}`);
  socket = ws;
  startConnectTimeout(ws);

  ws.onopen = () => {
    clearConnectTimeout();
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
        platform: Platform.OS as 'ios' | 'android',
        version: '0.0.1',
      },
    };
    ws.send(encode(hello));
    // A reconnect gives us a fresh server-side monitor; re-arm it if the user
    // left diagnostics on.
    if (useDiag.getState().enabled) {
      ws.send(encode({ v: PROTOCOL_VERSION, t: 'diag.set', on: true }));
    }
    startHeartbeat();
  };

  ws.onmessage = (event) => {
    const msg = decode(typeof event.data === 'string' ? event.data : '');
    if (!msg) return;
    handleMessage(msg);
  };

  ws.onerror = () => {
    useConnection.setState({ lastError: 'Could not reach that Mac' });
  };

  ws.onclose = () => {
    socket = null;
    clearTimers();
    // The token dies with the socket that issued it.
    udp.reset();
    syncPointerConfig({ datagramToken: '' });
    if (manuallyDisconnected) return;
    if (useConnection.getState().phase === 'pairing') return;
    scheduleReconnect();
  };
}

function startConnectTimeout(ws: WebSocket) {
  clearConnectTimeout();
  connectTimeout = setTimeout(() => {
    connectTimeout = null;
    if (socket !== ws || ws.readyState === WebSocket.OPEN) return;
    // Nothing ever came back from this socket. Detach it before closing so a
    // late `onclose` cannot schedule a second reconnect on top of ours.
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try {
      ws.close();
    } catch {}
    socket = null;
    clearTimers();
    useConnection.setState({ lastError: 'Could not reach that Mac' });
    if (manuallyDisconnected) return;
    scheduleReconnect();
  }, CONNECT_TIMEOUT_MS);
}

function clearConnectTimeout() {
  if (connectTimeout) {
    clearTimeout(connectTimeout);
    connectTimeout = null;
  }
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
  if (isAudioState(msg)) {
    useAudio.getState().applyRemote(msg.level, msg.muted);
    return;
  }
  if (isDisplayState(msg)) {
    useDisplay.getState().applyRemote(msg.asleep);
    return;
  }
  if (isDiagState(msg)) {
    useDiag.getState().applyRemote(msg);
    return;
  }
  if (isUdpOk(msg)) {
    udp.noteOk();
    syncPointerConfig({ datagramToken: udp.activeToken() ?? '' });
    return;
  }
  switch (msg.t) {
    case 'welcome': {
      useConnection.setState({
        serverName: msg.server.name,
        serverVersion: msg.server.version,
        serverCaps: msg.caps,
      });
      // The offer carries the port and this session's token. Absent means the
      // Mac has no datagram listener, and pointer frames stay on this socket.
      const { target } = useConnection.getState();
      if (target) udp.configure(target.host, msg.udp);
      return;
    }
    case 'pong': {
      if (msg.id === heartbeatPingId && pongTimeout) {
        clearTimeout(pongTimeout);
        pongTimeout = null;
      }
      const sentAt = pendingPings.get(msg.id);
      if (sentAt != null) {
        pendingPings.delete(msg.id);
        const rtt = Date.now() - sentAt;
        useConnection.setState({ latencyMs: rtt });
        recordRtt(rtt);
      }
      return;
    }
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

/** Ping cadence while diagnostics are on, so the round trip is sampled during
 *  a gesture rather than every few seconds. */
const DIAG_PING_INTERVAL_MS = 500;

function sendPing(): number | null {
  if (!socket || socket.readyState !== WebSocket.OPEN) return null;
  pingId += 1;
  const id = pingId;
  pendingPings.set(id, Date.now());
  // A pong that never arrives would otherwise keep its entry forever.
  if (pendingPings.size > 32) {
    const cutoff = Date.now() - 10_000;
    for (const [pending, sentAt] of pendingPings) {
      if (sentAt < cutoff) pendingPings.delete(pending);
    }
  }
  socket.send(encode({ v: PROTOCOL_VERSION, t: 'ping', id }));
  return id;
}

function startHeartbeat() {
  clearInterval(pingTimer ?? undefined);
  pingTimer = setInterval(() => {
    const id = sendPing();
    if (id == null) return;
    heartbeatPingId = id;
    if (pongTimeout) clearTimeout(pongTimeout);
    pongTimeout = setTimeout(() => {
      try {
        socket?.close();
      } catch {}
    }, HEARTBEAT_TIMEOUT_MS);
  }, HEARTBEAT_INTERVAL_MS);

  clearInterval(diagPingTimer ?? undefined);
  diagPingTimer = setInterval(() => {
    if (!useDiag.getState().enabled) return;
    sendPing();
  }, DIAG_PING_INTERVAL_MS);

  // One tick owns the counters, the datagram watchdog and the phone's half of
  // the diagnostics, so none of them can disagree about the same second.
  clearInterval(diagReportTimer ?? undefined);
  diagReportTimer = setInterval(() => {
    const counters = drainPointerCounters();
    udp.reviewPath(counters.sends);
    // Only a confirmed path is handed to the UI thread; anything else keeps
    // frames on the JS path, where the probation copy is sent.
    syncPointerConfig({ datagramToken: udp.activeToken() ?? '' });

    if (!useDiag.getState().enabled) return;
    const stats = tickPhoneStats(counters);
    useDiag.setState({ transport: udp.getState() });
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(encode({ v: PROTOCOL_VERSION, t: 'diag.report', ...stats }));
  }, 1000);
}

function scheduleReconnect() {
  const delay = Math.min(8000, 1000 * Math.pow(2, reconnectAttempt));
  reconnectAttempt += 1;
  useConnection.setState({ phase: 'reconnecting' });
  reconnectTimer = setTimeout(openSocket, delay);
}

function clearTimers() {
  clearConnectTimeout();
  pendingPings.clear();
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (diagPingTimer) {
    clearInterval(diagPingTimer);
    diagPingTimer = null;
  }
  if (diagReportTimer) {
    clearInterval(diagReportTimer);
    diagReportTimer = null;
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
