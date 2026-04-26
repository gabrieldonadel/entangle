import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import { DockGrid } from '@/features/dock/DockGrid';
import { SpacesBar } from '@/features/dock/SpacesBar';

export default function DockScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={{ top: true, bottom: true }} style={styles.safe}>
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
  root: { flex: 1, backgroundColor: '#000' },
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
});
