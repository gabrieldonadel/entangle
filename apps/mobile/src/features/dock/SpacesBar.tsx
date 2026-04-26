import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PROTOCOL_VERSION } from '@entangle/protocol';

import { sendMessage } from '@/net/send';

export function SpacesBar() {
  return (
    <View style={styles.bar}>
      <SpaceButton
        label="Prev Space"
        shortcut="⌃←"
        onPress={() =>
          sendMessage({ v: PROTOCOL_VERSION, t: 'g.space', dir: 'left' })
        }
      />
      <SpaceButton
        label="Mission Control"
        shortcut="⌃↑"
        onPress={() => sendMessage({ v: PROTOCOL_VERSION, t: 'g.mission' })}
      />
      <SpaceButton
        label="Next Space"
        shortcut="⌃→"
        onPress={() =>
          sendMessage({ v: PROTOCOL_VERSION, t: 'g.space', dir: 'right' })
        }
      />
    </View>
  );
}

function SpaceButton({
  label,
  shortcut,
  onPress,
}: {
  label: string;
  shortcut: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={() => {
        onPress();
        void Haptics.selectionAsync();
      }}>
      <Text style={styles.shortcut}>{shortcut}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2c2c2e',
    backgroundColor: '#0a0a0b',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
    gap: 4,
  },
  buttonPressed: {
    backgroundColor: '#2c2c2e',
  },
  shortcut: {
    color: '#0a84ff',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: '#8e8e93',
    fontSize: 11,
  },
});
