import {
  decideUdpSend,
  initialUdpState,
  noteUdpOk,
  reviewUdpPath,
  UDP_OK_TIMEOUT_MS,
  UDP_PROBE_TIMEOUT_MS,
} from '@entangle/protocol';
import type { UdpPolicyState } from '@entangle/protocol';

const T0 = 1_000_000;

describe('decideUdpSend', () => {
  it('uses the stream only when there is no datagram path', () => {
    const decision = decideUdpSend(initialUdpState('off'), T0);
    expect(decision.sendDatagram).toBe(false);
    expect(decision.sendStream).toBe(true);
    expect(decision.next.phase).toBe('off');
  });

  it('sends on both wires while proving the path', () => {
    const decision = decideUdpSend(initialUdpState('probing'), T0);
    expect(decision.sendDatagram).toBe(true);
    expect(decision.sendStream).toBe(true);
    expect(decision.next.phase).toBe('probing');
    // The probation clock starts with the first frame, not with the offer:
    // an idle pointer must not time the path out.
    expect(decision.next.probeStartedAt).toBe(T0);
  });

  it('drops the stream copy once the Mac confirms', () => {
    const probing = decideUdpSend(initialUdpState('probing'), T0).next;
    const confirmed = noteUdpOk(probing, T0 + 100);
    expect(confirmed.phase).toBe('active');

    const decision = decideUdpSend(confirmed, T0 + 200);
    expect(decision.sendDatagram).toBe(true);
    expect(decision.sendStream).toBe(false);
  });

  it('gives up on the datagram path when nothing is ever confirmed', () => {
    const started = decideUdpSend(initialUdpState('probing'), T0).next;
    const stillWaiting = decideUdpSend(started, T0 + UDP_PROBE_TIMEOUT_MS);
    expect(stillWaiting.sendDatagram).toBe(true);

    const gaveUp = decideUdpSend(stillWaiting.next, T0 + UDP_PROBE_TIMEOUT_MS + 1);
    expect(gaveUp.sendDatagram).toBe(false);
    expect(gaveUp.sendStream).toBe(true);
    expect(gaveUp.next.phase).toBe('off');
  });

  it('never leaves the pointer without a wire', () => {
    // Whatever the phase, every decision carries the frame somewhere.
    const states: UdpPolicyState[] = [
      initialUdpState('off'),
      initialUdpState('probing'),
      noteUdpOk(initialUdpState('probing'), T0),
    ];
    for (const state of states) {
      const decision = decideUdpSend(state, T0 + 10);
      expect(decision.sendDatagram || decision.sendStream).toBe(true);
    }
  });

  it('falls back to both wires when confirmations stop mid-stream', () => {
    let state = noteUdpOk(initialUdpState('probing'), T0);
    // Frames keep going out, and no further confirmation arrives.
    state = decideUdpSend(state, T0 + 500).next;
    const late = decideUdpSend(state, T0 + UDP_OK_TIMEOUT_MS + 100);
    expect(late.next.phase).toBe('probing');
    expect(late.sendStream).toBe(true);
    expect(late.next.lastOkAt).toBe(0);
  });

  it('stays active through silence while the pointer is idle', () => {
    // The Mac only confirms what it receives, so quiet proves nothing. A long
    // gap with no sends in it must not demote a working path.
    const active = noteUdpOk(initialUdpState('probing'), T0);
    const afterIdle = decideUdpSend(active, T0 + UDP_OK_TIMEOUT_MS * 4);
    expect(afterIdle.next.phase).toBe('active');
    expect(afterIdle.sendStream).toBe(false);
  });
});

describe('noteUdpOk', () => {
  it('promotes a probing path to active', () => {
    expect(noteUdpOk(initialUdpState('probing'), T0).phase).toBe('active');
  });

  it('cannot revive a path that was given up on', () => {
    // Only a fresh `welcome` reopens the socket, so a stray confirmation must
    // not put frames back on a socket nobody is holding.
    expect(noteUdpOk(initialUdpState('off'), T0).phase).toBe('off');
  });
});

describe('reviewUdpPath', () => {
  // Once the UI thread is sending frames, no per-frame decision runs on the
  // JS side. This is the only thing left that can notice a path going away.

  it('demotes a confirmed path that stops being confirmed', () => {
    const active = { ...noteUdpOk(initialUdpState('probing'), T0), lastSentAt: T0 + 500 };
    const reviewed = reviewUdpPath(active, T0 + UDP_OK_TIMEOUT_MS + 100);
    expect(reviewed.phase).toBe('probing');
    expect(reviewed.lastOkAt).toBe(0);
  });

  it('leaves a confirmed path alone while the pointer is idle', () => {
    // No sends recorded, so silence says nothing about the path.
    const active = noteUdpOk(initialUdpState('probing'), T0);
    expect(reviewUdpPath(active, T0 + UDP_OK_TIMEOUT_MS * 5).phase).toBe('active');
  });

  it('gives up on a probation that never got confirmed', () => {
    const probing = decideUdpSend(initialUdpState('probing'), T0).next;
    expect(reviewUdpPath(probing, T0 + UDP_PROBE_TIMEOUT_MS + 1).phase).toBe('off');
  });

  it('does not start the probation clock on its own', () => {
    // Nothing has been sent yet, so there is nothing to time out.
    const fresh = initialUdpState('probing');
    expect(reviewUdpPath(fresh, T0 + UDP_PROBE_TIMEOUT_MS * 10).phase).toBe('probing');
  });

  it('leaves a dead path dead', () => {
    expect(reviewUdpPath(initialUdpState('off'), T0).phase).toBe('off');
  });
});
