import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C } from '@/features/onboarding/atoms';
import {
  DiffReviewPanel,
  PendingDiffList,
  ReviewBar,
} from '@/features/cursor/DiffView';
import { useCursor, type TouchedFile } from '@/state/cursor';
import type { CursorPendingDiff } from '@entangle/protocol';

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

function joinPath(dir: string, name: string): string {
  if (!dir || dir === '.') return name;
  return `${dir.replace(/\/$/, '')}/${name}`;
}

function parentPath(dir: string): string | null {
  if (!dir || dir === '.') return null;
  const parts = dir.split('/').filter(Boolean);
  if (parts.length <= 1) return '.';
  parts.pop();
  return parts.join('/') || '.';
}

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

function opLabel(op: TouchedFile['op']): string {
  if (op === 'write') return 'edited';
  if (op === 'read') return 'read';
  return 'touched';
}

export function FileViewerSheet({
  visible,
  onClose,
  initialPath,
  pickMode,
  onPickPath,
}: {
  visible: boolean;
  onClose: () => void;
  /** When set, open this file as soon as the sheet appears. */
  initialPath?: string | null;
  /** When true, tapping a file inserts a reference instead of opening. */
  pickMode?: boolean;
  onPickPath?: (path: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const touchedFiles = useCursor((s) => s.touchedFiles);
  const pendingDiffs = useCursor((s) => s.pendingDiffs);
  const fileView = useCursor((s) => s.fileView);
  const listDir = useCursor((s) => s.listDir);
  const getFile = useCursor((s) => s.getFile);
  const clearFileView = useCursor((s) => s.clearFileView);
  const fetchDiffs = useCursor((s) => s.fetchDiffs);
  const [reviewing, setReviewing] = useState<CursorPendingDiff | null>(null);

  const recent = useMemo(
    () => [...touchedFiles].reverse().slice(0, 12),
    [touchedFiles],
  );

  useEffect(() => {
    if (!visible) return;
    if (!pickMode) fetchDiffs();
    if (initialPath && !pickMode) {
      const pending = useCursor
        .getState()
        .pendingDiffs.find((d) => d.path === initialPath);
      if (pending) {
        setReviewing(pending);
        return;
      }
      getFile(initialPath);
      return;
    }
    listDir('.');
  }, [visible, initialPath, getFile, listDir, fetchDiffs, pickMode]);

  useEffect(() => {
    if (!reviewing) return;
    const next = pendingDiffs.find((d) => d.path === reviewing.path);
    if (!next) setReviewing(null);
    else if (next !== reviewing) setReviewing(next);
  }, [pendingDiffs, reviewing]);

  const close = () => {
    setReviewing(null);
    clearFileView();
    onClose();
  };

  const viewingFile = !!fileView.filePath && !reviewing && !pickMode;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          {reviewing || viewingFile ? (
            <Pressable
              onPress={() => {
                setReviewing(null);
                const dir =
                  parentPath(reviewing?.path || fileView.filePath || '.') ?? '.';
                listDir(dir === '.' ? '.' : dir);
              }}
              hitSlop={12}
            >
              <Text style={styles.link}>‹ Back</Text>
            </Pressable>
          ) : parentPath(fileView.listPath) != null ? (
            <Pressable
              onPress={() => listDir(parentPath(fileView.listPath)!)}
              hitSlop={12}
            >
              <Text style={styles.link}>‹ Up</Text>
            </Pressable>
          ) : (
            <View style={{ width: 56 }} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {pickMode
              ? 'Mention file'
              : reviewing
                ? basename(reviewing.path)
                : viewingFile
                  ? basename(fileView.filePath || '')
                  : fileView.listPath === '.'
                    ? 'Files'
                    : fileView.listPath}
          </Text>
          <View style={styles.headerRight}>
            <Pressable onPress={close} hitSlop={12}>
              <Text style={styles.link}>Done</Text>
            </Pressable>
          </View>
        </View>

        {fileView.loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#64d2ff" />
          </View>
        ) : reviewing ? (
          <DiffReviewPanel file={reviewing} onClose={() => setReviewing(null)} />
        ) : viewingFile ? (
          <FileBody
            path={fileView.filePath!}
            text={fileView.text}
            truncated={fileView.truncated}
            binary={fileView.binary}
            bytes={fileView.bytes}
            error={fileView.fileError}
            imageBase64={fileView.imageBase64}
            mimeType={fileView.mimeType}
            onReload={() => getFile(fileView.filePath!)}
            pending={pendingDiffs.find((d) => d.path === fileView.filePath)}
            onReviewDiff={(d) => setReviewing(d)}
          />
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.listBody}>
              {!pickMode && recent.length ? (
                <>
                  <Text style={styles.section}>Recent</Text>
                  {recent.map((f) => (
                    <Pressable
                      key={`r:${f.path}`}
                      style={styles.row}
                      onPress={() => {
                        const pending = pendingDiffs.find((d) => d.path === f.path);
                        if (pending) setReviewing(pending);
                        else getFile(f.path);
                      }}
                    >
                      <Text style={styles.rowName} numberOfLines={1}>
                        {f.path}
                      </Text>
                      <Text style={styles.rowMeta}>{opLabel(f.op)}</Text>
                    </Pressable>
                  ))}
                </>
              ) : null}

              {!pickMode ? <PendingDiffList onOpen={(d) => setReviewing(d)} /> : null}

              <Text style={styles.section}>
                {fileView.listPath === '.' ? 'Workspace' : fileView.listPath}
              </Text>
              <View style={styles.navRow}>
                {parentPath(fileView.listPath) != null ? (
                  <Pressable onPress={() => listDir(parentPath(fileView.listPath)!)}>
                    <Text style={styles.link}>Up</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => listDir('.')}>
                    <Text style={styles.link}>Refresh</Text>
                  </Pressable>
                )}
                {pickMode ? (
                  <Pressable
                    onPress={() => {
                      onPickPath?.(
                        fileView.listPath === '.' ? '.' : fileView.listPath,
                      );
                      close();
                    }}
                  >
                    <Text style={styles.link}>Use this folder</Text>
                  </Pressable>
                ) : null}
              </View>

              {fileView.listError ? (
                <Text style={styles.error}>{fileView.listError}</Text>
              ) : null}

              {fileView.entries.map((entry) => (
                <Pressable
                  key={`${entry.kind}:${entry.name}`}
                  style={styles.row}
                  onPress={() => {
                    const path = joinPath(fileView.listPath, entry.name);
                    if (pickMode) {
                      if (entry.kind === 'dir') listDir(path);
                      else {
                        onPickPath?.(path);
                        close();
                      }
                      return;
                    }
                    if (entry.kind === 'dir') listDir(path);
                    else {
                      const pending = pendingDiffs.find((d) => d.path === path);
                      if (pending) setReviewing(pending);
                      else getFile(path);
                    }
                  }}
                >
                  <Text style={styles.rowName} numberOfLines={1}>
                    {entry.kind === 'dir' ? `📁 ${entry.name}/` : `📄 ${entry.name}`}
                  </Text>
                  {entry.kind === 'file' && entry.size != null ? (
                    <Text style={styles.rowMeta}>{formatBytes(entry.size)}</Text>
                  ) : null}
                </Pressable>
              ))}

              {!fileView.entries.length && !fileView.listError ? (
                <Text style={styles.empty}>No files here.</Text>
              ) : null}
            </ScrollView>
            {!pickMode ? (
              <ReviewBar
                onOpenDiff={(path) => {
                  const pending = pendingDiffs.find((d) => d.path === path);
                  if (pending) setReviewing(pending);
                }}
              />
            ) : null}
          </>
        )}
      </View>
    </Modal>
  );
}

function FileBody({
  path,
  text,
  truncated,
  binary,
  bytes,
  error,
  imageBase64,
  mimeType,
  onReload,
  pending,
  onReviewDiff,
}: {
  path: string;
  text: string | null;
  truncated: boolean;
  binary: boolean;
  bytes: number | null;
  error: string | null;
  imageBase64: string | null;
  mimeType: string | null;
  onReload: () => void;
  pending?: CursorPendingDiff;
  onReviewDiff: (d: CursorPendingDiff) => void;
}) {
  const uri =
    imageBase64 && mimeType ? `data:${mimeType};base64,${imageBase64}` : null;

  return (
    <View style={styles.flex}>
      <View style={styles.fileMeta}>
        <Text style={styles.path} numberOfLines={2} selectable>
          {path}
        </Text>
        {pending ? (
          <Pressable onPress={() => onReviewDiff(pending)} hitSlop={8}>
            <Text style={styles.link}>Diff</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onReload} hitSlop={8}>
          <Text style={styles.link}>Reload</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {uri ? (
        <ScrollView contentContainerStyle={styles.imagePad}>
          <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
          {bytes != null ? <Text style={styles.empty}>{formatBytes(bytes)}</Text> : null}
        </ScrollView>
      ) : binary ? (
        <Text style={styles.empty}>
          Binary file{bytes != null ? ` (${formatBytes(bytes)})` : ''} — cannot
          preview on phone. Open it on the Mac, or reference it with @ in chat.
        </Text>
      ) : null}
      {truncated ? (
        <Text style={styles.warn}>Preview truncated to first ~512 KB.</Text>
      ) : null}
      {text != null ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.codePad}
          horizontal={false}
        >
          <ScrollView horizontal>
            <Text style={styles.code} selectable>
              {text}
            </Text>
          </ScrollView>
        </ScrollView>
      ) : !error && !binary && !uri ? (
        <Text style={styles.empty}>Empty file.</Text>
      ) : null}
    </View>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  headerRight: { minWidth: 48, alignItems: 'flex-end' },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  link: { color: '#64d2ff', fontSize: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listBody: { paddingHorizontal: 16, paddingBottom: 32, gap: 2 },
  section: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 16,
    marginBottom: 6,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  rowName: { flex: 1, color: '#fff', fontSize: 15 },
  rowMeta: { color: '#8e8e93', fontSize: 12 },
  empty: { color: '#8e8e93', fontSize: 14, marginTop: 12 },
  error: { color: '#ff453a', fontSize: 13, marginVertical: 8 },
  warn: { color: '#ff9f0a', fontSize: 12, paddingHorizontal: 16, paddingTop: 8 },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  path: { flex: 1, color: '#aeaeb2', fontSize: 12, fontFamily: MONO },
  codePad: { padding: 16 },
  code: { color: '#e5e5ea', fontFamily: MONO, fontSize: 12, lineHeight: 18 },
  imagePad: { padding: 16, alignItems: 'center', gap: 8 },
  previewImage: { width: '100%', height: 360, borderRadius: 8 },
});
