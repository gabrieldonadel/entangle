import {
  decideUdpSend,
  encodeDatagram,
  initialUdpState,
  noteUdpOk,
  reviewUdpPath,
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
  // Makes the socket reachable from the UI thread. Failure is not fatal: the
  // pointer keeps going through the JS path.
  EntangleUdp.installOnWorkletRuntime();
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

/**
 * The token to hand the UI thread, or null while frames should stay on the
 * JS path. Only a confirmed path is worth sending to directly, because the
 * probation copy has to come from the JS side.
 */
export function activeToken(): string | null {
  return policy.phase === 'active' ? token : null;
}

/**
 * Re-applies the timeouts once a second.
 *
 * While the UI thread is sending, no per-frame decision runs here, so this is
 * the only thing that can notice the confirmations stopping. `sends` is how
 * many frames went out in the last second — silence with no sends proves
 * nothing.
 */
export function reviewPath(sends: number): void {
  if (policy.phase === 'off' || token == null) return;
  const now = Date.now();
  if (sends > 0) {
    policy = { ...policy, lastSentAt: now };
  }
  const next = reviewUdpPath(policy, now);
  if (next === policy) return;
  policy = next;
  if (policy.phase === 'off') reset();
}
