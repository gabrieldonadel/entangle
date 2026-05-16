import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import { PracticeBanner } from '@/features/demo/PracticeBanner';
import { DockGrid } from '@/features/dock/DockGrid';
import { SpacesBar } from '@/features/dock/SpacesBar';
import { C } from '@/features/onboarding/atoms';
import { useConnection } from '@/state/connection';

export default function DockScreen() {
  const demo = useConnection((s) => s.demo);
  return (
    <View style={styles.root}>
      <SafeAreaView edges={{ top: true, bottom: true }} style={styles.safe}>
        {demo ? (
          <View style={styles.bannerWrap}>
            <PracticeBanner />
          </View>
        ) : null}
        <View style={styles.header}>
          <Text style={styles.title}>Dock</Text>
          <Text style={styles.subtitle}>Tap an app to bring it to the front.</Text>
        </View>
        <View style={styles.grid}>
          <DockGrid />
        </View>
        <SpacesBar />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8e8e93',
    fontSize: 13,
    marginTop: 2,
  },
  grid: {
    flex: 1,
  },
  bannerWrap: {
    paddingTop: 8,
    paddingBottom: 4,
  },
});
