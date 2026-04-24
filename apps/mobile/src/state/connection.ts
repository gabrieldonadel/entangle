import { create } from 'zustand';

import {
  decode,
  encode,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  PROTOCOL_VERSION,
} from '@entangle/protocol';
import type { ClientMessage, Message } from '@entangle/protocol';

export type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed';

export interface ConnectionTarget {
  name: string;
  host: string;
  port: number;
}

interface ConnectionState {
  phase: ConnectionPhase;
  target: ConnectionTarget | null;
  serverName: string | null;
  lastError: string | null;
  latencyMs: number | null;
  connect: (target: ConnectionTarget) => void;
  disconnect: () => void;
  send: (msg: ClientMessage) => void;
  sendRaw: (raw: string) => void;
}

let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pongTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let pingId = 0;
let pingSentAt = 0;
let manuallyDisconnected = false;

export const useConnection = create<ConnectionState>((set, get) => ({
  phase: 'idle',
  target: null,
  serverName: null,
  lastError: null,
  latencyMs: null,
  connect: (target) => {
    manuallyDisconnected = false;
    reconnectAttempt = 0;
    set({ target, lastError: null });
    openSocket();
  },
  disconnect: () => {
    manuallyDisconnected = true;
    clearTimers();
    if (socket) {
      try {
        socket.close();
      } catch {}
      socket = null;
    }
    set({ phase: 'idle', target: null, serverName: null, latencyMs: null });
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
    scheduleReconnect();
  };
}

function handleMessage(msg: Message) {
  switch (msg.t) {
    case 'welcome':
      useConnection.setState({ serverName: msg.server.name });
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
    default:
      return;
  }
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
