/**
 * When to trust the datagram path.
 *
 * This lives beside the protocol because it is the other half of the `udp.ok`
 * contract: the Mac promises to confirm datagrams it receives, and this
 * decides what to conclude from those confirmations — or from their absence.
 *
 * The rule that matters: a blocked port is indistinguishable from a working
 * one at the sending end, so the phone never simply switches over. It sends on
 * both wires until the Mac confirms, and it goes back to both if the
 * confirmations stop. The worst case is the behaviour from before UDP existed,
 * never a dead pointer.
 *
 * Pure and state-in/state-out, so the decisions can be tested without a
 * socket, a device or a Mac.
 */

export type UdpPhase = 'off' | 'probing' | 'active';

export interface UdpPolicyState {
  phase: UdpPhase;
  /** When the current probation began; 0 before the first frame. */
  probeStartedAt: number;
  /** Last `udp.ok`; 0 if none since the probation started. */
  lastOkAt: number;
  /** Last frame put on the datagram path. */
  lastSentAt: number;
}

export interface UdpDecision {
  next: UdpPolicyState;
  /** Put the frame on the datagram path. */
  sendDatagram: boolean;
  /** Put the frame on the WebSocket as well, or instead. */
  sendStream: boolean;
}

/** How long to send on both wires before giving up on datagrams. */
export const UDP_PROBE_TIMEOUT_MS = 1500;
/** Confirmations missing this long, while still sending, means it broke. */
export const UDP_OK_TIMEOUT_MS = 3000;

export function initialUdpState(phase: UdpPhase = 'off'): UdpPolicyState {
  return { phase, probeStartedAt: 0, lastOkAt: 0, lastSentAt: 0 };
}

export function noteUdpOk(state: UdpPolicyState, now: number): UdpPolicyState {
  if (state.phase === 'off') return state;
  return { ...state, phase: 'active', lastOkAt: now };
}

export function decideUdpSend(state: UdpPolicyState, now: number): UdpDecision {
  if (state.phase === 'off') {
    return { next: state, sendDatagram: false, sendStream: true };
  }

  let phase = state.phase;
  let probeStartedAt = state.probeStartedAt;
  let lastOkAt = state.lastOkAt;

  // Frames are going out and nothing is coming back. Note the check against
  // `lastSentAt`: silence while the pointer is idle proves nothing, because
  // the Mac only confirms what it receives.
  if (
    phase === 'active' &&
    now - lastOkAt > UDP_OK_TIMEOUT_MS &&
    now - state.lastSentAt < UDP_OK_TIMEOUT_MS
  ) {
    phase = 'probing';
    probeStartedAt = now;
    lastOkAt = 0;
  }

  if (phase === 'probing') {
    if (probeStartedAt === 0) {
      probeStartedAt = now;
    } else if (lastOkAt === 0 && now - probeStartedAt > UDP_PROBE_TIMEOUT_MS) {
      // Sent for a while, never confirmed. Something is eating these.
      return {
        next: initialUdpState('off'),
        sendDatagram: false,
        sendStream: true,
      };
    }
  }

  return {
    next: { phase, probeStartedAt, lastOkAt, lastSentAt: now },
    sendDatagram: true,
    // During probation the datagram may be going nowhere, so the stream
    // carries a copy. Duplicates are dropped by sequence number on arrival.
    sendStream: phase !== 'active',
  };
}
