import {
  CLIPBOARD_MAX_IMAGE_BYTES,
  CLIPBOARD_MAX_IMAGE_EDGE,
  decode,
  encode,
  isClipboardPush,
  PROTOCOL_VERSION,
} from '@entangle/protocol';
import type { ClipboardPushMessage, ClipboardSyncMessage } from '@entangle/protocol';

describe('clipboard messages', () => {
  it('round-trips a cb.sync request', () => {
    const sync: ClipboardSyncMessage = {
      v: PROTOCOL_VERSION,
      t: 'cb.sync',
      on: true,
    };
    expect(decode(encode(sync))).toEqual(sync);
  });

  it('round-trips a text cb.push', () => {
    const push: ClipboardPushMessage = {
      v: PROTOCOL_VERSION,
      t: 'cb.push',
      kind: 'text',
      text: 'hello',
      gen: 3,
    };
    const decoded = decode(encode(push));
    expect(decoded).not.toBeNull();
    expect(isClipboardPush(decoded!)).toBe(true);
    expect(decoded).toEqual(push);
  });

  it('round-trips an image cb.push', () => {
    const push: ClipboardPushMessage = {
      v: PROTOCOL_VERSION,
      t: 'cb.push',
      kind: 'image',
      imagePng: 'iVBORw0KGgo=',
      gen: 1,
    };
    expect(decode(encode(push))).toEqual(push);
  });

  it('round-trips an empty cb.push', () => {
    const push: ClipboardPushMessage = {
      v: PROTOCOL_VERSION,
      t: 'cb.push',
      kind: 'empty',
      gen: 0,
    };
    expect(decode(encode(push))).toEqual(push);
  });

  it('does not treat other messages as clipboard push', () => {
    const audio = decode(
      encode({ v: PROTOCOL_VERSION, t: 'state.audio', level: 0.5, muted: false }),
    );
    expect(audio).not.toBeNull();
    expect(isClipboardPush(audio!)).toBe(false);
  });

  it('rejects a clipboard message from a mismatched protocol version', () => {
    expect(
      decode(JSON.stringify({ v: PROTOCOL_VERSION + 1, t: 'cb.sync', on: true })),
    ).toBeNull();
  });

  it('exports size caps used by both ends', () => {
    expect(CLIPBOARD_MAX_IMAGE_EDGE).toBe(2048);
    expect(CLIPBOARD_MAX_IMAGE_BYTES).toBe(1_048_576);
  });
});
