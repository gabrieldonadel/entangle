import {
  decideUdpSend,
  encodeDatagram,
  initialUdpState,
  noteUdpOk,
} from '@entangle/protocol';
import type { ClientMessage, UdpOffer, UdpPolicyState } from '@entangle/protocol';
import * as EntangleUdp from 'entangle-udp';

/**
 * The datagram path for pointer frames.
 *
 * The decision of whether to trust it lives in `@entangle/protocol`'s
 * `udp-policy`, next to the `udp.ok` message that drives it; this module is
 * the socket and the state that policy runs on.
 */

let policy: UdpPolicyState = initialUdpState('off');
let token: string | null = null;

export function configure(host: string, offer?: UdpOffer): void {
  reset();
  if (!offer || !EntangleUdp.isAvailable) return;
  if (!EntangleUdp.open(host, offer.port)) return;
  token = offer.token;
  policy = initialUdpState('probing');
}

export function reset(): void {
  if (policy.phase !== 'off') EntangleUdp.close();
  policy = initialUdpState('off');
  token = null;
}

/** The Mac says datagrams are landing. */
export function noteOk(): void {
  policy = noteUdpOk(policy, Date.now());
}

/**
 * Puts a frame on the datagram path if it is worth trying. Returns false when
 * the caller has to use the WebSocket instead.
 */
export function trySend(msg: ClientMessage): boolean {
  if (token == null) return false;
  const decision = decideUdpSend(policy, Date.now());
  policy = decision.next;
  if (!decision.sendDatagram) {
    // Giving up closes the socket; `configure` reopens it on the next welcome.
    if (policy.phase === 'off') reset();
    return false;
  }
  const sent = EntangleUdp.send(encodeDatagram(token, msg));
  return sent && !decision.sendStream;
}

/**
 * True while the frame also has to go over the WebSocket. `trySend` already
 * folds this into its return value; this exists for callers that want to be
 * explicit about why.
 */
export function needsStreamCopy(): boolean {
  return policy.phase !== 'active';
}

export function getState(): UdpPolicyState['phase'] {
  return policy.phase;
}
