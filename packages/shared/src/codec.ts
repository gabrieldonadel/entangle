import { PROTOCOL_VERSION } from './constants';
import type {
  ClientMessage,
  Message,
  PointerMoveMessage,
  ServerMessage,
  WelcomeMessage,
  DockListResponseMessage,
  DockUpdateMessage,
  PongMessage,
} from './messages';

const CLIENT_TAGS = new Set<ClientMessage['t']>([
  'p.move',
  'p.click',
  'p.drag',
  's.wheel',
  'g.space',
  'g.mission',
  'k.text',
  'k.key',
  'd.list',
  'd.activate',
  'hello',
  'ping',
]);

const SERVER_TAGS = new Set<ServerMessage['t']>([
  'welcome',
  'pong',
  'error',
  'd.list',
  'd.update',
  'state.mods',
]);

const ALL_TAGS = new Set<string>([...CLIENT_TAGS, ...SERVER_TAGS]);

export function encode(msg: Message): string {
  return JSON.stringify(msg);
}

export function decode(raw: string): Message | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isMessageShape(parsed)) return null;
  return parsed as Message;
}

function isMessageShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj.v !== PROTOCOL_VERSION) return false;
  if (typeof obj.t !== 'string') return false;
  return ALL_TAGS.has(obj.t);
}

export function isPointerMove(msg: Message): msg is PointerMoveMessage {
  return msg.t === 'p.move';
}

export function isWelcome(msg: Message): msg is WelcomeMessage {
  return msg.t === 'welcome';
}

export function isPong(msg: Message): msg is PongMessage {
  return msg.t === 'pong';
}

export function isDockListResponse(msg: Message): msg is DockListResponseMessage {
  return msg.t === 'd.list' && 'apps' in msg;
}

export function isDockUpdate(msg: Message): msg is DockUpdateMessage {
  return msg.t === 'd.update';
}
