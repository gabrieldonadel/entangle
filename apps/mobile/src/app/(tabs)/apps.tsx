import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';

import { router } from '@/lib/router';
import { C } from '@/features/onboarding/atoms';
import { useConnection } from '@/state/connection';

export default function AppsScreen() {
  const { serverCaps, cursorIcon } = useConnection(
    useShallow((s) => ({
      serverCaps: s.serverCaps,
      cursorIcon: s.serverIcons.cursor,
    })),
  );
  const cursorReady = serverCaps.includes('cursor');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.heading}>Apps</Text>
        <Pressable
          style={[styles.card, !cursorReady && styles.cardDisabled]}
          disabled={!cursorReady}
          onPress={() => router.push('/cursor')}
        >
          <View style={styles.icon}>
            {cursorIcon ? (
              <Image
                source={{ uri: `data:image/png;base64,${cursorIcon}` }}
                style={styles.iconImage}
              />
            ) : (
              <Text style={styles.iconGlyph}>⌘</Text>
            )}
          </View>
          <View style={styles.labels}>
            <Text style={styles.title}>Cursor</Text>
            <Text style={styles.subtitle}>
              {cursorReady
                ? 'Local agent on your Mac'
                : 'Enable Cursor in Entangle Preferences on your Mac'}
            </Text>
          </View>
          {cursorReady ? <Text style={styles.chevron}>›</Text> : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: 40,
    height: 40,
  },
  iconGlyph: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  labels: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: '#8e8e93',
    fontSize: 13,
  },
  chevron: {
    color: '#636366',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
});
