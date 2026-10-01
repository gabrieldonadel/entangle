import { forwardRef, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import {
  ModFlags,
  PROTOCOL_VERSION,
  shortcutForChar,
} from '@entangle/protocol';

import { sendMessage } from '@/net/send';
import { useConnection } from '@/state/connection';
import { useModifiers } from '@/state/modifiers';

export interface HiddenInputHandle {
  focus: () => void;
  blur: () => void;
}

export const HiddenInput = forwardRef<
  TextInput,
  { onFocusChange?: (focused: boolean) => void; inputAccessoryViewID?: string }
>(
  ({ onFocusChange, inputAccessoryViewID }, ref) => {
    const [buffer, setBuffer] = useState('');
    const lastRef = useRef('');
    const mask = useModifiers((s) => s.mask);
    const consumeMods = useModifiers((s) => s.consume);
    // Letter / digit key codes are newer than the first desktop release, so a
    // Mac that does not advertise them still gets the character as plain text
    // rather than a `k.key` it would silently drop.
    const canShortcut = useConnection(
      (s) => s.demo || s.serverCaps.includes('shortcuts'),
    );

    /**
     * Sends a latched modifier combination (⌘C, ⌘⇧Z) as a key event. Returns
     * true when the character was consumed as a shortcut and must not also be
     * typed as text.
     */
    const trySendShortcut = (added: string) => {
      if (mask === ModFlags.None || !canShortcut) return false;
      const shortcut = shortcutForChar(added);
      if (!shortcut) return false;
      const shift = shortcut.shift ? ModFlags.Shift : ModFlags.None;
      const mods = consumeMods() | shift;
      sendMessage({
        v: PROTOCOL_VERSION,
        t: 'k.key',
        code: shortcut.code,
        phase: 'tap',
        mods,
      });
      return true;
    };

    const handleChangeText = (next: string) => {
      const previous = lastRef.current;
      if (next.length > previous.length && next.startsWith(previous)) {
        const added = next.slice(previous.length);
        // The character still lands in the (invisible, never-read) buffer when
        // it becomes a shortcut — rewinding the controlled value is unreliable
        // on Android, and the next diff only needs `lastRef` to stay truthful.
        if (!trySendShortcut(added)) {
          sendMessage({ v: PROTOCOL_VERSION, t: 'k.text', text: added });
        }
      } else if (next.length < previous.length && previous.startsWith(next)) {
        const removed = previous.length - next.length;
        for (let i = 0; i < removed; i += 1) {
          sendMessage({
            v: PROTOCOL_VERSION,
            t: 'k.key',
            code: 'Backspace',
            phase: 'tap',
            mods: ModFlags.None,
          });
        }
      } else {
        const common = commonPrefixLength(previous, next);
        const removed = previous.length - common;
        for (let i = 0; i < removed; i += 1) {
          sendMessage({
            v: PROTOCOL_VERSION,
            t: 'k.key',
            code: 'Backspace',
            phase: 'tap',
            mods: ModFlags.None,
          });
        }
        const added = next.slice(common);
        if (added) {
          sendMessage({ v: PROTOCOL_VERSION, t: 'k.text', text: added });
        }
      }
      lastRef.current = next;
      setBuffer(next);
    };

    return (
      <TextInput
        ref={ref}
        value={buffer}
        onChangeText={handleChangeText}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        textContentType="none"
        autoComplete="off"
        multiline
        caretHidden
        style={styles.hidden}
        keyboardAppearance="dark"
        inputAccessoryViewID={inputAccessoryViewID}
      />
    );
  }
);
HiddenInput.displayName = 'HiddenInput';

function commonPrefixLength(a: string, b: string) {
  const limit = Math.min(a.length, b.length);
  let idx = 0;
  while (idx < limit && a.charCodeAt(idx) === b.charCodeAt(idx)) {
    idx += 1;
  }
  return idx;
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
    left: 0,
    top: 0,
  },
});
