import {
  decode,
  encode,
  encodeDatagram,
  isPointerMove,
  PROTOCOL_VERSION,
} from '@entangle/protocol';
import type { PointerMoveMessage } from '@entangle/protocol';

describe('pointer frames', () => {
  it('round-trips a cumulative frame', () => {
    const frame: PointerMoveMessage = {
      v: PROTOCOL_VERSION,
      t: 'p.move',
      dx: 1.5,
      dy: -0.25,
      cx: 42.75,
      cy: -3.5,
      g: 7,
      seq: 118,
    };
    const decoded = decode(encode(frame));
    expect(decoded).not.toBeNull();
    expect(isPointerMove(decoded!)).toBe(true);
    expect(decoded).toEqual(frame);
  });

  it('still accepts a frame with deltas only', () => {
    // What an older phone sends. The Mac falls back to `dx`/`dy`.
    const legacy: PointerMoveMessage = {
      v: PROTOCOL_VERSION,
      t: 'p.move',
      dx: 2,
      dy: 2,
      seq: 3,
    };
    const decoded = decode(encode(legacy));
    expect(decoded).toEqual(legacy);
    expect(decoded).not.toHaveProperty('cx');
    expect(decoded).not.toHaveProperty('g');
  });

  it('keeps the totals independent of the per-frame deltas', () => {
    // The invariant the Mac relies on: the totals are the sum of the deltas
    // sent so far in the gesture, so either field alone tracks the cursor.
    const frames: PointerMoveMessage[] = [
      { v: PROTOCOL_VERSION, t: 'p.move', dx: 3, dy: 1, cx: 3, cy: 1, g: 1, seq: 1 },
      { v: PROTOCOL_VERSION, t: 'p.move', dx: 2, dy: -1, cx: 5, cy: 0, g: 1, seq: 2 },
      { v: PROTOCOL_VERSION, t: 'p.move', dx: -1, dy: 4, cx: 4, cy: 4, g: 1, seq: 3 },
    ];
    let dx = 0;
    let dy = 0;
    for (const frame of frames) {
      dx += frame.dx;
      dy += frame.dy;
      expect(frame.cx).toBeCloseTo(dx);
      expect(frame.cy).toBeCloseTo(dy);
    }
  });
});

describe('datagram envelope', () => {
  it('wraps a message with the session token', () => {
    const frame: PointerMoveMessage = {
      v: PROTOCOL_VERSION,
      t: 'p.move',
      dx: 1,
      dy: 2,
      cx: 1,
      cy: 2,
      g: 3,
      seq: 4,
    };
    const parsed = JSON.parse(encodeDatagram('deadbeef', frame));
    expect(parsed).toEqual({ v: PROTOCOL_VERSION, tk: 'deadbeef', m: frame });
  });

  it('keeps the token out of the message itself', () => {
    // The Mac authenticates the envelope and dispatches `m` unchanged, so the
    // message shape has to be identical on both transports.
    const frame: PointerMoveMessage = {
      v: PROTOCOL_VERSION,
      t: 'p.move',
      dx: 0,
      dy: 0,
      seq: 1,
    };
    const parsed = JSON.parse(encodeDatagram('token', frame));
    expect(parsed.m).not.toHaveProperty('tk');
    expect(decode(JSON.stringify(parsed.m))).toEqual(frame);
  });
});
