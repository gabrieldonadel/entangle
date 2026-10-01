import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { CursorPendingDiff } from '@entangle/protocol';
import { useCursor } from '@/state/cursor';
import { parseUnifiedDiff, type DiffLine } from '@/features/cursor/diff-parse';

export type { DiffLine };
export { parseUnifiedDiff };

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export function DiffLines({ diff }: { diff: string }) {
  const rows = useMemo(() => parseUnifiedDiff(diff), [diff]);
  return (
    <ScrollView horizontal nestedScrollEnabled>
      <View>
        {rows.map((row) => (
          <Text
            key={row.key}
            style={[
              styles.line,
              row.kind === 'add' && styles.lineAdd,
              row.kind === 'del' && styles.lineDel,
              row.kind === 'hunk' && styles.lineHunk,
              row.kind === 'meta' && styles.lineMeta,
            ]}
            selectable
          >
            {row.text || ' '}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

export function ReviewBar({
  onOpenDiff,
}: {
  onOpenDiff?: (path: string) => void;
}) {
  const pendingDiffs = useCursor((s) => s.pendingDiffs);
  const keepFiles = useCursor((s) => s.keepFiles);
  const discardFiles = useCursor((s) => s.discardFiles);

  if (!pendingDiffs.length) return null;

  const added = pendingDiffs.reduce((n, f) => n + (f.linesAdded || 0), 0);
  const removed = pendingDiffs.reduce((n, f) => n + (f.linesRemoved || 0), 0);
  const n = pendingDiffs.length;

  const confirmKeep = () => {
    Alert.alert(
      'Keep all changes?',
      `Accept edits in ${n} file${n === 1 ? '' : 's'} (+${added} / −${removed}).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep All',
          style: 'default',
          onPress: () => keepFiles(),
        },
      ],
    );
  };

  const confirmDiscard = () => {
    Alert.alert(
      'Discard all changes?',
      `Revert edits in ${n} file${n === 1 ? '' : 's'}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => discardFiles(),
        },
      ],
    );
  };

  return (
    <View style={styles.bar}>
      <Pressable
        style={styles.barSummary}
        onPress={() => onOpenDiff?.(pendingDiffs[pendingDiffs.length - 1]?.path)}
      >
        <Text style={styles.barTitle}>
          {n} file{n === 1 ? '' : 's'} changed
        </Text>
        <Text style={styles.barCounts}>
          <Text style={styles.addCount}>+{added}</Text>
          {'  '}
          <Text style={styles.delCount}>−{removed}</Text>
        </Text>
      </Pressable>
      <Pressable style={styles.discardBtn} onPress={confirmDiscard}>
        <Text style={styles.discardLabel}>Discard</Text>
      </Pressable>
      <Pressable style={styles.keepBtn} onPress={confirmKeep}>
        <Text style={styles.keepLabel}>Keep All</Text>
      </Pressable>
    </View>
  );
}

export function PendingDiffList({
  onOpen,
}: {
  onOpen: (diff: CursorPendingDiff) => void;
}) {
  const pendingDiffs = useCursor((s) => s.pendingDiffs);
  if (!pendingDiffs.length) return null;
  return (
    <View style={styles.pendingList}>
      <Text style={styles.pendingTitle}>Review changes</Text>
      {pendingDiffs.map((f) => (
        <Pressable key={f.path} style={styles.pendingRow} onPress={() => onOpen(f)}>
          <Text style={styles.pendingPath} numberOfLines={1}>
            {f.path}
          </Text>
          <Text style={styles.barCounts}>
            <Text style={styles.addCount}>+{f.linesAdded}</Text>
            {' '}
            <Text style={styles.delCount}>−{f.linesRemoved}</Text>
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DiffReviewPanel({
  file,
  onClose,
}: {
  file: CursorPendingDiff;
  onClose: () => void;
}) {
  const keepFiles = useCursor((s) => s.keepFiles);
  const discardFiles = useCursor((s) => s.discardFiles);
  const [busy, setBusy] = useState(false);

  const confirmKeep = () => {
    Alert.alert('Keep this file?', `Accept changes to ${file.path}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Keep',
        onPress: () => {
          setBusy(true);
          keepFiles([file.path]);
          onClose();
        },
      },
    ]);
  };

  const confirmDiscard = () => {
    Alert.alert(
      'Discard this file?',
      `Revert ${file.path} to its previous contents. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            discardFiles([file.path]);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.diffPanel}>
      <View style={styles.diffHeader}>
        <Text style={styles.diffPath} numberOfLines={2}>
          {file.path}
        </Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
      </View>
      <Text style={styles.barCounts}>
        <Text style={styles.addCount}>+{file.linesAdded}</Text>
        {'  '}
        <Text style={styles.delCount}>−{file.linesRemoved}</Text>
      </Text>
      <ScrollView style={styles.diffScroll} contentContainerStyle={styles.diffPad}>
        <DiffLines diff={file.diff} />
      </ScrollView>
      <View style={styles.diffActions}>
        <Pressable
          style={[styles.discardBtn, styles.diffActionBtn, busy && styles.disabled]}
          disabled={busy}
          onPress={confirmDiscard}
        >
          <Text style={styles.discardLabel}>Discard</Text>
        </Pressable>
        <Pressable
          style={[styles.keepBtn, styles.diffActionBtn, busy && styles.disabled]}
          disabled={busy}
          onPress={confirmKeep}
        >
          <Text style={styles.keepLabel}>Keep</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 16,
    color: '#aeaeb2',
    paddingHorizontal: 8,
  },
  lineAdd: {
    backgroundColor: 'rgba(52, 199, 89, 0.18)',
    color: '#30d158',
  },
  lineDel: {
    backgroundColor: 'rgba(255, 69, 58, 0.18)',
    color: '#ff453a',
  },
  lineHunk: { color: '#64d2ff', backgroundColor: 'rgba(100, 210, 255, 0.08)' },
  lineMeta: { color: '#636366' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2c2c2e',
    backgroundColor: '#141416',
  },
  barSummary: { flex: 1, gap: 2 },
  barTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  barCounts: { fontFamily: MONO, fontSize: 12 },
  addCount: { color: '#30d158' },
  delCount: { color: '#ff453a' },
  keepBtn: {
    backgroundColor: '#30d158',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keepLabel: { color: '#003a12', fontWeight: '700', fontSize: 13 },
  discardBtn: {
    backgroundColor: '#2c2c2e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ff453a',
  },
  discardLabel: { color: '#ff453a', fontWeight: '700', fontSize: 13 },
  pendingList: { marginTop: 12, gap: 4 },
  pendingTitle: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  pendingPath: { flex: 1, color: '#fff', fontFamily: MONO, fontSize: 13 },
  diffPanel: { flex: 1, gap: 8 },
  diffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  diffPath: { flex: 1, color: '#fff', fontFamily: MONO, fontSize: 13 },
  link: { color: '#64d2ff', fontSize: 16 },
  diffScroll: { flex: 1 },
  diffPad: { paddingBottom: 24 },
  diffActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  diffActionBtn: { flex: 1, alignItems: 'center' },
  disabled: { opacity: 0.45 },
});
