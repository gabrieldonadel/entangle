import type { KeyCode } from './messages';

/**
 * A character typed on the phone's soft keyboard, resolved to the key the Mac
 * should see. `k.text` has no modifier mask, so a latched ⌘ can only reach the
 * Mac as a `k.key` — and that needs the character translated back into a key
 * identifier.
 *
 * `shift` is true when the glyph itself is only reachable with Shift held
 * (`C`, `?`, `_`): the Mac has to receive the base key plus a Shift flag, not
 * the shifted glyph.
 */
export interface Shortcut {
  code: KeyCode;
  shift: boolean;
}

/**
 * Keys whose unshifted glyph is the character itself. Layout-dependent by
 * nature — these are the US/ANSI positions, which is also what the Mac's
 * virtual key codes are numbered against.
 */
const UNSHIFTED: Record<string, KeyCode> = {
  '-': 'Minus',
  '=': 'Equal',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '\\': 'Backslash',
  ';': 'Semicolon',
  "'": 'Quote',
  '`': 'Backquote',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ' ': 'Space',
  '\n': 'Return',
  '\t': 'Tab',
};

/** Glyphs that a US/ANSI keyboard produces with Shift held. */
const SHIFTED: Record<string, KeyCode> = {
  '_': 'Minus',
  '+': 'Equal',
  '{': 'BracketLeft',
  '}': 'BracketRight',
  '|': 'Backslash',
  ':': 'Semicolon',
  '"': 'Quote',
  '~': 'Backquote',
  '<': 'Comma',
  '>': 'Period',
  '?': 'Slash',
  '!': 'Digit1',
  '@': 'Digit2',
  '#': 'Digit3',
  '$': 'Digit4',
  '%': 'Digit5',
  '^': 'Digit6',
  '&': 'Digit7',
  '*': 'Digit8',
  '(': 'Digit9',
  ')': 'Digit0',
};

/**
 * Resolves a single typed character to a key identifier, or null when the
 * character has no key of its own (anything composed, accented or non-Latin —
 * those stay on the `k.text` path, where the Mac inserts them verbatim).
 */
export function shortcutForChar(char: string): Shortcut | null {
  if (char.length !== 1) return null;

  if (char >= 'a' && char <= 'z') {
    return { code: letterCode(char), shift: false };
  }
  if (char >= 'A' && char <= 'Z') {
    return { code: letterCode(char.toLowerCase()), shift: true };
  }
  if (char >= '0' && char <= '9') {
    return { code: `Digit${char}` as KeyCode, shift: false };
  }

  const unshifted = UNSHIFTED[char];
  if (unshifted) return { code: unshifted, shift: false };

  const shifted = SHIFTED[char];
  if (shifted) return { code: shifted, shift: true };

  return null;
}

function letterCode(lower: string): KeyCode {
  return `Key${lower.toUpperCase()}` as KeyCode;
}
