import { encode } from '@entangle/protocol';
import type { ClientMessage } from '@entangle/protocol';

import { getSocket } from '@/state/connection';

import * as udp from './udp';

export function sendMessage(msg: ClientMessage) {
  const ws = getSocket();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(encode(msg));
  }
}

/**
 * Sends a pointer frame over the datagram path when it is trusted, and over
 * the WebSocket otherwise — or over both, while the datagram path is still
 * being proven. Duplicates are harmless: frames carry the gesture's running
 * total and a sequence number, so the Mac applies whichever arrives first.
 *
 * `alsoStream` forces the WebSocket copy. Callers use it before a click or a
 * scroll, which travel on the stream: ordering only holds within one
 * transport, so the frame that positions the cursor has to be on the same
 * wire as the message that acts on that position.
 */
export function sendPointerFrame(msg: ClientMessage, alsoStream = false) {
  // `trySend` returns true only when the datagram path carried the frame on
  // its own; during probation it sends one and asks for the stream copy too.
  const handled = udp.trySend(msg);
  if (alsoStream || !handled) {
    sendMessage(msg);
  }
}
