import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ClientInfo } from '../server-state';
import { normalizeHost, useServerStore } from '../server-state';
import { fonts, tokens } from '../theme';

type Props = {
  client: ClientInfo | null;
  onClose: () => void;
};

export function DeviceMenuSheet({ client, onClose }: Props) {
  const clientNames = useServerStore((s) => s.clientNames);
  const renameClient = useServerStore((s) => s.renameClient);
  const disconnectClient = useServerStore((s) => s.disconnectClient);
  const forgetClient = useServerStore((s) => s.forgetClient);

  const persistedName = client
    ? clientNames[normalizeHost(client.host)] ?? ''
    : '';

  const [draftName, setDraftName] = useState(persistedName);

  // Reset the draft any time we open this sheet on a different device.
  useEffect(() => {
    setDraftName(persistedName);
  }, [client?.id, persistedName]);

  if (!client) return null;

  const submitRename = async () => {
    const trimmed = draftName.trim();
    await renameClient(client.id, trimmed.length === 0 ? null : trimmed);
    onClose();
  };

  const handleDisconnect = () => {
    void disconnectClient(client.id);
    onClose();
  };

  const handleForget = () => {
    Alert.alert(
      'Forget this device?',
      'It will be disconnected and have to pair again on next connect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: () => {
            void forgetClient(client.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Pressable style={styles.dismissCatcher} onPress={onClose} />
      <View style={styles.backdrop} pointerEvents="box-none">
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Device</Text>
            <Pressable onPress={onClose} style={styles.close}>
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder={client.host || 'unnamed device'}
              placeholderTextColor={tokens.textDim}
              style={styles.input}
              autoCorrect={false}
              spellCheck={false}
              onSubmitEditing={() => void submitRename()}
              returnKeyType="done"
            />
            <Text style={styles.hint}>
              Stored locally on this Mac and reused next time the device connects.
            </Text>

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
              Address
            </Text>
            <Text style={styles.address}>{client.host || '—'}</Text>

            <View style={styles.actions}>
              <Pressable style={styles.secondary} onPress={handleDisconnect}>
                <Text style={styles.secondaryLabel}>Disconnect</Text>
              </Pressable>
              <Pressable style={styles.destructive} onPress={handleForget}>
                <Text style={styles.destructiveLabel}>Forget</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.ghost} onPress={onClose}>
              <Text style={styles.ghostLabel}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={() => void submitRename()}>
              <Text style={styles.primaryLabel}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  dismissCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,9,12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: 460,
    maxHeight: '92%',
    backgroundColor: 'rgba(20,23,30,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  headerRow: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: -0.14,
    color: tokens.text,
  },
  close: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    color: tokens.textMid,
    fontSize: 11,
    lineHeight: 11,
  },
  body: {
    padding: 20,
  },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: tokens.textDim,
    marginBottom: 6,
  },
  fieldLabelSpaced: {
    marginTop: 16,
  },
  input: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 6,
    color: tokens.text,
    fontSize: 13,
  },
  hint: {
    fontSize: 11,
    color: tokens.textDim,
    marginTop: 6,
  },
  address: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: tokens.textHigh,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  secondary: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  secondaryLabel: {
    color: tokens.textHigh,
    fontSize: 13,
    fontWeight: '500',
  },
  destructive: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,69,58,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.28)',
    alignItems: 'center',
  },
  destructiveLabel: {
    color: tokens.danger,
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  ghost: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ghostLabel: {
    color: tokens.textHigh,
    fontSize: 12.5,
  },
  primary: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
  primaryLabel: {
    color: '#0e1014',
    fontWeight: '500',
    fontSize: 12.5,
  },
});
