import { decode, encode, isDisplayState, PROTOCOL_VERSION } from '@entangle/protocol';
import type { DisplayStateMessage, SystemUnlockMessage } from '@entangle/protocol';

describe('lock messages', () => {
  it('round-trips a sys.unlock request', () => {
    const unlock: SystemUnlockMessage = {
      v: PROTOCOL_VERSION,
      t: 'sys.unlock',
      password: 'hunter2',
    };
    expect(decode(encode(unlock))).toEqual(unlock);
  });

  it('round-trips a display state carrying the lock flag', () => {
    const state: DisplayStateMessage = {
      v: PROTOCOL_VERSION,
      t: 'state.display',
      asleep: false,
      locked: true,
    };
    const decoded = decode(encode(state));
    expect(decoded).not.toBeNull();
    expect(isDisplayState(decoded!)).toBe(true);
    expect(decoded).toEqual(state);
  });

  it('accepts a display state from a Mac that predates the lock flag', () => {
    // `locked` is optional on the wire so an older Mac stays readable; the
    // phone reads a missing flag as unlocked.
    const decoded = decode(
      JSON.stringify({ v: PROTOCOL_VERSION, t: 'state.display', asleep: true }),
    );
    expect(decoded).not.toBeNull();
    expect(isDisplayState(decoded!)).toBe(true);
    expect((decoded as DisplayStateMessage).locked).toBeUndefined();
  });

  it('rejects an unlock from a mismatched protocol version', () => {
    expect(
      decode(
        JSON.stringify({ v: PROTOCOL_VERSION + 1, t: 'sys.unlock', password: 'x' }),
      ),
    ).toBeNull();
  });
});
