import { useEffect, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModifierBar } from './ModifierBar';
import { SpecialKeys } from './SpecialKeys';

/** Ties the bar to the hidden input's `inputAccessoryViewID` on iOS. */
export const KEYBOARD_BAR_ID = 'entangle.keyboardBar';

/**
 * Modifier keys and special keys, docked to the top of the soft keyboard.
 *
 * iOS gets this for free from `InputAccessoryView`. Android has no equivalent,
 * so the bar is positioned over the layout instead — which is why `visible`
 * exists: there is nothing on that platform tying the bar's lifetime to the
 * input's focus.
 */
export function KeyboardBar({ visible }: { visible: boolean }) {
  if (Platform.OS === 'ios') {
    return (
      <InputAccessoryView nativeID={KEYBOARD_BAR_ID}>
        <Bar />
      </InputAccessoryView>
    );
  }
  if (Platform.OS !== 'android') return null;
  return <AndroidKeyboardBar visible={visible} />;
}

function Bar() {
  return (
    <View style={styles.bar}>
      <ModifierBar />
      <View style={styles.specialKeys}>
        <SpecialKeys />
      </View>
    </View>
  );
}

function AndroidKeyboardBar({ visible }: { visible: boolean }) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  if (!visible || keyboardHeight === 0) return null;

  // Android 16 makes edge-to-edge mandatory, so the React root spans the whole
  // window and the IME draws over it — nothing resizes out from under us, and
  // the bar has to clear the keyboard on its own. `keyboardDidShow` reports the
  // IME height with the system bars already subtracted (see `ReactRootView`),
  // so the navigation bar has to be added back to reach the keyboard's top.
  return (
    <View style={[styles.floating, { bottom: keyboardHeight + insets.bottom }]}>
      <Bar />
    </View>
  );
}

function useKeyboardHeight() {
  const [height, setHeight] = useState(() => Keyboard.metrics()?.height ?? 0);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bar: {
    padding: 12,
    gap: 8,
    backgroundColor: '#0a0a0b',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2c2c2e',
  },
  specialKeys: {
    marginHorizontal: -4,
  },
});
