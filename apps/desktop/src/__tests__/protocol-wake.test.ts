import {
  decode,
  encode,
  isDisplayState,
  PROTOCOL_VERSION,
} from '@entangle/protocol';
import type { DisplayStateMessage, SystemWakeMessage } from '@entangle/protocol';

describe('wake messages', () => {
  it('round-trips a sys.wake request', () => {
    const wake: SystemWakeMessage = { v: PROTOCOL_VERSION, t: 'sys.wake' };
    expect(decode(encode(wake))).toEqual(wake);
  });

  it('round-trips a state.display push', () => {
    const state: DisplayStateMessage = {
      v: PROTOCOL_VERSION,
      t: 'state.display',
      asleep: true,
    };
    const decoded = decode(encode(state));
    expect(decoded).not.toBeNull();
    expect(isDisplayState(decoded!)).toBe(true);
    expect(decoded).toEqual(state);
  });

  it('does not treat other pushes as display state', () => {
    const audio = decode(
      encode({ v: PROTOCOL_VERSION, t: 'state.audio', level: 0.5, muted: false }),
    );
    expect(audio).not.toBeNull();
    expect(isDisplayState(audio!)).toBe(false);
  });

  it('rejects a wake message from a mismatched protocol version', () => {
    expect(decode(JSON.stringify({ v: PROTOCOL_VERSION + 1, t: 'sys.wake' }))).toBeNull();
  });
});
