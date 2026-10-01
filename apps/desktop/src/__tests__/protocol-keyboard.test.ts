import {
  decode,
  encode,
  ModFlags,
  PROTOCOL_VERSION,
  shortcutForChar,
} from '@entangle/protocol';
import type { KeyPressMessage } from '@entangle/protocol';

describe('keyboard messages', () => {
  it('round-trips a special key with a modifier mask', () => {
    const press: KeyPressMessage = {
      v: PROTOCOL_VERSION,
      t: 'k.key',
      code: 'Tab',
      phase: 'tap',
      mods: ModFlags.Command,
    };
    expect(decode(encode(press))).toEqual(press);
  });

  it('round-trips a letter key, so ⌘C can travel as a key event', () => {
    const press: KeyPressMessage = {
      v: PROTOCOL_VERSION,
      t: 'k.key',
      code: 'KeyC',
      phase: 'tap',
      mods: ModFlags.Command,
    };
    expect(decode(encode(press))).toEqual(press);
  });
});

describe('shortcutForChar', () => {
  it('maps lowercase letters to their key, with no implied shift', () => {
    expect(shortcutForChar('c')).toEqual({ code: 'KeyC', shift: false });
    expect(shortcutForChar('z')).toEqual({ code: 'KeyZ', shift: false });
  });

  it('maps uppercase letters to the base key plus shift', () => {
    expect(shortcutForChar('Z')).toEqual({ code: 'KeyZ', shift: true });
  });

  it('maps digits', () => {
    expect(shortcutForChar('0')).toEqual({ code: 'Digit0', shift: false });
    expect(shortcutForChar('7')).toEqual({ code: 'Digit7', shift: false });
  });

  it('maps unshifted punctuation to the key printed on it', () => {
    expect(shortcutForChar('-')).toEqual({ code: 'Minus', shift: false });
    expect(shortcutForChar(',')).toEqual({ code: 'Comma', shift: false });
    expect(shortcutForChar('/')).toEqual({ code: 'Slash', shift: false });
  });

  it('maps shifted glyphs back to the base key plus shift', () => {
    // ⌘+ is "zoom in" on a Mac, and the key it lives on is Equal.
    expect(shortcutForChar('+')).toEqual({ code: 'Equal', shift: true });
    expect(shortcutForChar('?')).toEqual({ code: 'Slash', shift: true });
    expect(shortcutForChar('!')).toEqual({ code: 'Digit1', shift: true });
  });

  it('maps space and return, which carry their own shortcuts', () => {
    expect(shortcutForChar(' ')).toEqual({ code: 'Space', shift: false });
    expect(shortcutForChar('\n')).toEqual({ code: 'Return', shift: false });
  });

  it('leaves anything without a key of its own on the text path', () => {
    // Composed, accented and non-Latin input has no single key behind it, and
    // multi-character insertions come from autocorrect rather than a keypress.
    expect(shortcutForChar('é')).toBeNull();
    expect(shortcutForChar('あ')).toBeNull();
    expect(shortcutForChar('€')).toBeNull();
    expect(shortcutForChar('ab')).toBeNull();
    expect(shortcutForChar('')).toBeNull();
  });
});
