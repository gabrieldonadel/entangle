import { forwardRef, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { ModFlags, PROTOCOL_VERSION } from '@entangle/protocol';

import { sendMessage } from '@/net/send';

export interface HiddenInputHandle {
  focus: () => void;
  blur: () => void;
}

export const HiddenInput = forwardRef<TextInput, { onFocusChange?: (focused: boolean) => void }>(
  ({ onFocusChange }, ref) => {
    const [buffer, setBuffer] = useState('');
    const lastRef = useRef('');

    const handleChangeText = (next: string) => {
      const previous = lastRef.current;
      if (next.length > previous.length && next.startsWith(previous)) {
        const added = next.slice(previous.length);
        sendMessage({ v: PROTOCOL_VERSION, t: 'k.text', text: added });
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
