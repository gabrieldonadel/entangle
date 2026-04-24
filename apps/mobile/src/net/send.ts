import { encode } from '@entangle/protocol';
import type { ClientMessage } from '@entangle/protocol';

import { getSocket } from '@/state/connection';

export function sendMessage(msg: ClientMessage) {
  const ws = getSocket();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(encode(msg));
  }
}
