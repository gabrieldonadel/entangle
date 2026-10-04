import {
  decode,
  encode,
  isMediaState,
  PROTOCOL_VERSION,
} from '@entangle/protocol';
import type {
  MediaCommand,
  MediaCommandMessage,
  MediaStateMessage,
} from '@entangle/protocol';

describe('media messages', () => {
  it.each<MediaCommand>(['playpause', 'next', 'prev'])(
    'round-trips an m.cmd %s',
    (cmd) => {
      const msg: MediaCommandMessage = { v: PROTOCOL_VERSION, t: 'm.cmd', cmd };
      expect(decode(encode(msg))).toEqual(msg);
    },
  );

  it('round-trips a fully populated state.media push', () => {
    const state: MediaStateMessage = {
      v: PROTOCOL_VERSION,
      t: 'state.media',
      playing: true,
      title: 'Everything In Its Right Place',
      artist: 'Radiohead',
      album: 'Kid A',
      app: 'Music',
    };
    const decoded = decode(encode(state));
    expect(decoded).not.toBeNull();
    expect(isMediaState(decoded!)).toBe(true);
    expect(decoded).toEqual(state);
  });

  it('round-trips a push with no metadata', () => {
    // What a browser tab looks like: the Mac knows something is playing but no
    // player announced what it is.
    const state: MediaStateMessage = {
      v: PROTOCOL_VERSION,
      t: 'state.media',
      playing: true,
    };
    const decoded = decode(encode(state));
    expect(decoded).toEqual(state);
    expect(decoded).not.toHaveProperty('title');
  });

  it('does not treat other pushes as media state', () => {
    const audio = decode(
      encode({ v: PROTOCOL_VERSION, t: 'state.audio', level: 0.5, muted: false }),
    );
    expect(audio).not.toBeNull();
    expect(isMediaState(audio!)).toBe(false);
  });

  it('rejects a media message from a mismatched protocol version', () => {
    expect(
      decode(JSON.stringify({ v: PROTOCOL_VERSION + 1, t: 'm.cmd', cmd: 'next' })),
    ).toBeNull();
  });

  it('rejects an unknown tag that looks like a media command', () => {
    expect(
      decode(JSON.stringify({ v: PROTOCOL_VERSION, t: 'm.seek', position: 10 })),
    ).toBeNull();
  });
});
