import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import * as ImagePicker from 'expo-image-picker';

import { router } from '@/lib/router';
import { C } from '@/features/onboarding/atoms';
import { MarkdownBody } from '@/features/cursor/MarkdownBody';
import { FileViewerSheet } from '@/features/cursor/FileViewer';
import { ReviewBar } from '@/features/cursor/DiffView';
import {
  toDisplayRows,
  type DisplayRow,
  type ToolChip,
} from '@/features/cursor/chat-display';
import { useConnection } from '@/state/connection';
import { useCursor, type CursorChatItem } from '@/state/cursor';
import type { CursorModelInfo } from '@entangle/protocol';

const EXAMPLE = 'Fix the failing test';
const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

type DraftImage = { data: string; mimeType: string; previewUri: string };

export default function CursorScreen() {
  const insets = useSafeAreaInsets();
  const phase = useConnection((s) => s.phase);
  const serverCaps = useConnection(useShallow((s) => s.serverCaps));
  const cursorReady = serverCaps.includes('cursor');
  const linked = phase === 'open';
  const status = useCursor((s) => s.status);
  const cwd = useCursor((s) => s.cwd);
  const model = useCursor((s) => s.model);
  const error = useCursor((s) => s.error);
  const items = useCursor((s) => s.items);
  const lastTurnUsage = useCursor((s) => s.lastTurnUsage);
  const prompt = useCursor((s) => s.prompt);
  const cancel = useCursor((s) => s.cancel);
  const resume = useCursor((s) => s.resume);
  const requestSnapshot = useCursor((s) => s.requestSnapshot);
  const fetchWorkspaces = useCursor((s) => s.fetchWorkspaces);
  const [draft, setDraft] = useState('');
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [filesInitialPath, setFilesInitialPath] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList<DisplayRow>>(null);
  const didResume = useRef(false);
  const touchedFiles = useCursor((s) => s.touchedFiles);

  const rows = useMemo(() => toDisplayRows(items), [items]);
  const streaming = status === 'running' || status === 'starting';
  const lastThinkingId = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].role === 'thinking') return items[i].id;
    }
    return null;
  }, [items]);

  useEffect(() => {
    if (!cursorReady || !linked) return;
    requestSnapshot();
    fetchWorkspaces();
    if (!didResume.current) {
      didResume.current = true;
      resume();
    }
  }, [cursorReady, linked, requestSnapshot, resume, fetchWorkspaces]);

  // KeyboardAvoidingView is unreliable for bottom composers on edge-to-edge
  // layouts; pad explicitly from keyboard frame so Send stays visible.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    if (rows.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [rows.length, items[items.length - 1]?.text, keyboardHeight]);

  const busy = streaming;
  const canSend = linked && cursorReady;
  const keyboardOpen = keyboardHeight > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={[styles.flex, keyboardOpen && { paddingBottom: keyboardHeight }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ Apps</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Cursor</Text>
            {cwd ? (
              <Text style={styles.headerCwd} numberOfLines={1}>
                {workspaceLabel(cwd)}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => {
                setFilesInitialPath(null);
                setFilesOpen(true);
              }}
              hitSlop={10}
              disabled={!canSend}
              style={styles.headerActionBtn}
            >
              <Text style={[styles.headerIcon, !canSend && styles.gearDisabled]}>
                📁{touchedFiles.length ? (
                  <Text style={styles.headerBadge}> {touchedFiles.length}</Text>
                ) : null}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSettingsOpen(true)}
              hitSlop={10}
              disabled={!canSend}
              style={styles.headerActionBtn}
            >
              <Text style={[styles.headerIcon, !canSend && styles.gearDisabled]}>⚙</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={styles.statusStrip}
          onPress={() => canSend && setSettingsOpen(true)}
          disabled={!canSend}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor: linked
                  ? statusColor(status)
                  : phase === 'reconnecting' || phase === 'connecting'
                    ? '#FF9F0A'
                    : '#FF453A',
              },
            ]}
          />
          <Text style={styles.statusLabel}>
            {!linked
              ? phase === 'reconnecting' || phase === 'connecting'
                ? 'Reconnecting…'
                : 'Disconnected'
              : statusLabel(status)}
          </Text>
          {model ? <Text style={styles.meta}>{model}</Text> : null}
          <Text style={styles.statusHint}>Details</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!linked ? (
          <Text style={styles.error}>
            {phase === 'reconnecting' || phase === 'connecting'
              ? 'Looking for your Mac on the network…'
              : 'Not connected. Go back and pick your Mac on the Connect screen.'}
          </Text>
        ) : null}

        {!cursorReady ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Cursor is not available</Text>
            <Text style={styles.emptyBody}>
              On your Mac, open Entangle Preferences → Cursor, set an API key and
              workspace, turn on Allow phones, and install Node 22.13+.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.flex}
            contentContainerStyle={styles.listContent}
            data={rows}
            keyExtractor={(row) =>
              row.kind === 'tools'
                ? `tools-${row.id}`
                : row.kind === 'shell'
                  ? `shell-${row.item.id}`
                  : row.item.id
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Ask Cursor to work on this project</Text>
                <Text style={styles.emptyBody}>
                  Prompts run a local agent on your Mac against the workspace set
                  in Entangle Preferences.
                </Text>
                <Pressable style={styles.chip} onPress={() => setDraft(EXAMPLE)}>
                  <Text style={styles.chipText}>{EXAMPLE}</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item: row }) =>
              row.kind === 'tools' ? (
                <ToolGroup
                  chips={row.chips}
                  onOpenPath={(path) => {
                    setFilesInitialPath(path);
                    setFilesOpen(true);
                  }}
                />
              ) : row.kind === 'shell' ? (
                <ShellBlock text={row.item.text} />
              ) : (
                <Bubble
                  item={row.item}
                  expandThinking={
                    streaming && row.item.role === 'thinking' && row.item.id === lastThinkingId
                  }
                />
              )
            }
          />
        )}

        {touchedFiles.length && cursorReady ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.touchedStrip}
            contentContainerStyle={styles.touchedStripContent}
          >
            {[...touchedFiles].reverse().slice(0, 8).map((f) => (
              <Pressable
                key={`touch-${f.path}`}
                style={[
                  styles.touchedChip,
                  f.op === 'write' && styles.touchedChipWrite,
                ]}
                onPress={() => {
                  setFilesInitialPath(f.path);
                  setFilesOpen(true);
                }}
              >
                <Text style={styles.touchedChipText} numberOfLines={1}>
                  {f.op === 'write' ? '✎ ' : ''}
                  {f.path.split('/').pop() || f.path}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {cursorReady ? (
          <ReviewBar
            onOpenDiff={(path) => {
              setFilesInitialPath(path);
              setFilesOpen(true);
            }}
          />
        ) : null}

        <View
          style={[
            styles.composer,
            { paddingBottom: keyboardOpen ? 10 : Math.max(10, insets.bottom) },
          ]}
        >
          {draftImages.length ? (
            <ScrollView
              horizontal
              style={styles.attachStrip}
              contentContainerStyle={styles.attachStripContent}
            >
              {draftImages.map((img, i) => (
                <Pressable
                  key={`att-${i}`}
                  style={styles.attachThumbWrap}
                  onPress={() =>
                    setDraftImages((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <Image source={{ uri: img.previewUri }} style={styles.attachThumb} />
                  <Text style={styles.attachRemove}>✕</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.composerRow}>
            <Pressable
              style={styles.composerIconBtn}
              disabled={!canSend}
              onPress={() => setMentionOpen(true)}
              hitSlop={8}
            >
              <Text style={[styles.composerIcon, !canSend && styles.gearDisabled]}>@</Text>
            </Pressable>
            <Pressable
              style={styles.composerIconBtn}
              disabled={!canSend || draftImages.length >= 4}
              onPress={() => void pickAttachment(setDraftImages)}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.composerIcon,
                  (!canSend || draftImages.length >= 4) && styles.gearDisabled,
                ]}
              >
                🖼
              </Text>
            </Pressable>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask Cursor…  (@ to mention files)"
              placeholderTextColor="#636366"
              multiline
              editable={canSend}
            />
            {busy ? (
              <Pressable style={styles.cancelBtn} onPress={cancel}>
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.sendBtn,
                  (!draft.trim() && !draftImages.length) || !canSend
                    ? styles.sendDisabled
                    : null,
                ]}
                disabled={(!draft.trim() && !draftImages.length) || !canSend}
                onPress={() => {
                  const text = draft;
                  const images = draftImages.map(({ data, mimeType }) => ({
                    data,
                    mimeType,
                  }));
                  setDraft('');
                  setDraftImages([]);
                  prompt(text, images.length ? { images } : undefined);
                }}
              >
                <Text style={styles.sendLabel}>Send</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <CursorSettingsSheet
        visible={settingsOpen && cursorReady}
        onClose={() => setSettingsOpen(false)}
        cwd={cwd}
        lastTurnUsage={lastTurnUsage}
      />
      <FileViewerSheet
        visible={filesOpen && cursorReady}
        onClose={() => {
          setFilesOpen(false);
          setFilesInitialPath(null);
        }}
        initialPath={filesInitialPath}
      />
      <FileViewerSheet
        visible={mentionOpen && cursorReady}
        pickMode
        onClose={() => setMentionOpen(false)}
        onPickPath={(path) => {
          const insert = path === '.' ? '@.' : `@${path}`;
          setDraft((d) => (d ? `${d.trimEnd()} ${insert} ` : `${insert} `));
          setMentionOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

async function pickAttachment(
  setDraftImages: Dispatch<SetStateAction<DraftImage[]>>,
) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.75,
    base64: true,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets?.[0]) return;
  const asset = result.assets[0];
  if (!asset.base64) return;
  const mimeType = asset.mimeType || 'image/jpeg';
  setDraftImages((prev) => {
    if (prev.length >= 4) return prev;
    return [
      ...prev,
      {
        data: asset.base64!,
        mimeType,
        previewUri: asset.uri,
      },
    ];
  });
}

function CursorSettingsSheet({
  visible,
  onClose,
  cwd,
  lastTurnUsage,
}: {
  visible: boolean;
  onClose: () => void;
  cwd: string | null;
  lastTurnUsage: { totalTokens?: number } | null;
}) {
  const model = useCursor((s) => s.model);
  const models = useCursor((s) => s.models);
  const modelParams = useCursor((s) => s.modelParams);
  const agents = useCursor((s) => s.agents);
  const workspaces = useCursor((s) => s.workspaces);
  const account = useCursor((s) => s.account);
  const usage = useCursor((s) => s.usage);
  const fetchModels = useCursor((s) => s.fetchModels);
  const setModel = useCursor((s) => s.setModel);
  const fetchUsage = useCursor((s) => s.fetchUsage);
  const fetchAccount = useCursor((s) => s.fetchAccount);
  const fetchAgents = useCursor((s) => s.fetchAgents);
  const fetchWorkspaces = useCursor((s) => s.fetchWorkspaces);
  const setWorkspace = useCursor((s) => s.setWorkspace);
  const fetchMoreAgents = useCursor((s) => s.fetchMoreAgents);
  const agentsNextCursor = useCursor((s) => s.agentsNextCursor);
  const openAgent = useCursor((s) => s.openAgent);
  const newChat = useCursor((s) => s.newChat);
  const shareTranscript = useCursor((s) => s.shareTranscript);
  const [paramDraft, setParamDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!visible) return;
    // Clear stale account so we don't show a previous email while refetching.
    useCursor.setState({ account: null });
    fetchModels();
    fetchAccount();
    fetchUsage();
    fetchAgents();
    fetchWorkspaces();
  }, [visible, fetchModels, fetchAccount, fetchUsage, fetchAgents, fetchWorkspaces]);

  useEffect(() => {
    const selected = models.find((m) => m.id === model);
    const next: Record<string, string> = {};
    for (const p of modelParams) next[p.id] = p.value;
    if (selected?.params) {
      for (const def of selected.params) {
        if (next[def.id] == null && def.values?.[0]?.id) {
          next[def.id] = def.values[0].id;
        }
      }
    }
    setParamDraft(next);
  }, [models, model, modelParams]);

  const selectedModel: CursorModelInfo | undefined = models.find((m) => m.id === model);

  const applyModel = (id: string) => {
    const info = models.find((m) => m.id === id);
    const params =
      info?.params
        ?.map((p) => {
          const value = paramDraft[p.id] ?? p.values?.[0]?.id;
          return value ? { id: p.id, value } : null;
        })
        .filter((p): p is { id: string; value: string } => !!p) ?? [];
    setModel(id, params);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Cursor settings</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.sheetDone}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <Text style={styles.section}>Workspace</Text>
            {(workspaces.length
              ? workspaces
              : cwd
                ? [{ path: cwd, name: cwd.split('/').filter(Boolean).pop() || cwd }]
                : []
            ).map((ws) => {
              const selected = ws.path === cwd;
              return (
                <Pressable
                  key={ws.path}
                  style={[styles.rowBtn, selected && styles.rowBtnSelected]}
                  onPress={() => {
                    if (!selected) setWorkspace(ws.path);
                  }}
                >
                  <Text style={styles.rowText}>{ws.name || workspaceLabel(ws.path)}</Text>
                  <Text style={styles.rowHint} numberOfLines={1} selectable>
                    {ws.kind === 'code-workspace' ? 'Multi-root · ' : ''}
                    {ws.path}
                  </Text>
                  {selected ? (
                    <Text style={styles.rowHint}>Active · chats below are for this workspace</Text>
                  ) : null}
                </Pressable>
              );
            })}
            {!workspaces.length && !cwd ? (
              <Text style={styles.rowHint}>
                No workspaces yet. Add folders or .code-workspace files in Entangle
                Preferences → Cursor on the Mac.
              </Text>
            ) : null}
            <Text style={styles.rowHint}>
              Last turn:{' '}
              {lastTurnUsage?.totalTokens != null
                ? `${lastTurnUsage.totalTokens} tokens`
                : '—'}
            </Text>

            <Text style={styles.section}>Account</Text>
            <Text style={styles.rowText}>
              {account == null
                ? 'Loading…'
                : account.error
                  ? account.error
                  : account.userEmail ||
                    account.apiKeyName ||
                    'API key connected'}
            </Text>
            {account?.apiKeyName && account?.userEmail ? (
              <Text style={styles.rowHint}>{account.apiKeyName}</Text>
            ) : null}

            <Text style={styles.section}>Model</Text>
            {(models.length ? models : [{ id: model || 'default', displayName: model || 'Default' }]).map(
              (m) => (
                <Pressable
                  key={m.id}
                  style={[styles.rowBtn, model === m.id && styles.rowBtnSelected]}
                  onPress={() => applyModel(m.id)}
                >
                  <Text style={styles.rowText}>{m.displayName || m.id}</Text>
                  {m.description ? (
                    <Text style={styles.rowHint} numberOfLines={2}>
                      {m.description}
                    </Text>
                  ) : null}
                </Pressable>
              ),
            )}

            {selectedModel?.params?.map((param) => (
              <View key={param.id} style={styles.paramBlock}>
                <Text style={styles.rowHint}>{param.displayName || param.id}</Text>
                <View style={styles.paramRow}>
                  {(param.values ?? []).map((v) => {
                    const selected = paramDraft[param.id] === v.id;
                    return (
                      <Pressable
                        key={v.id}
                        style={[styles.paramChip, selected && styles.paramChipOn]}
                        onPress={() => {
                          const next = { ...paramDraft, [param.id]: v.id };
                          setParamDraft(next);
                          if (model) {
                            setModel(
                              model,
                              Object.entries(next).map(([id, value]) => ({ id, value })),
                            );
                          }
                        }}
                      >
                        <Text style={styles.paramChipText}>{v.label || v.id}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            <Text style={styles.section}>Usage</Text>
            <Text style={styles.rowText}>
              Last turn:{' '}
              {lastTurnUsage?.totalTokens != null
                ? `${lastTurnUsage.totalTokens} tokens`
                : '—'}
            </Text>
            <Text style={styles.rowText}>
              Agent total:{' '}
              {usage?.usage?.totalTokens != null && usage.usage.totalTokens > 0
                ? `${usage.usage.totalTokens} tokens`
                : '—'}
              {usage?.costCents != null ? ` · $${(usage.costCents / 100).toFixed(4)}` : ''}
            </Text>
            {usage?.error ? (
              <Text style={styles.rowHint}>{usage.error}</Text>
            ) : null}
            <Pressable style={styles.actionBtn} onPress={fetchUsage}>
              <Text style={styles.actionLabel}>Refresh usage</Text>
            </Pressable>

            <Text style={styles.section}>Chats</Text>
            <Pressable
              style={styles.actionBtn}
              onPress={() => {
                newChat();
                onClose();
              }}
            >
              <Text style={styles.actionLabel}>New chat</Text>
            </Pressable>
            {agents.map((agent) => (
              <Pressable
                key={agent.agentId}
                style={styles.rowBtn}
                onPress={() => {
                  openAgent(agent.agentId);
                  onClose();
                }}
              >
                <Text style={styles.rowText}>{agent.name || agent.agentId}</Text>
                {agent.summary ? (
                  <Text style={styles.rowHint} numberOfLines={2}>
                    {agent.summary}
                  </Text>
                ) : null}
                <Text style={styles.rowHint}>
                  {formatWhen(agent.lastModified)}
                  {agent.status ? ` · ${agent.status}` : ''}
                </Text>
              </Pressable>
            ))}
            {agentsNextCursor ? (
              <Pressable style={styles.actionBtn} onPress={fetchMoreAgents}>
                <Text style={styles.actionLabel}>Load more chats</Text>
              </Pressable>
            ) : null}
            {!agents.length ? (
              <Text style={styles.rowHint}>No past chats in this workspace yet.</Text>
            ) : null}

            <Text style={styles.section}>Transcript</Text>
            <Pressable style={styles.actionBtn} onPress={() => void shareTranscript()}>
              <Text style={styles.actionLabel}>Share / copy transcript</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Bubble({
  item,
  expandThinking,
}: {
  item: CursorChatItem;
  expandThinking?: boolean;
}) {
  if (item.role === 'thinking') {
    return <ThinkingBubble item={item} preferExpanded={!!expandThinking} />;
  }
  const mine = item.role === 'user';
  if (mine) {
    return (
      <View style={[styles.bubble, styles.bubbleMine]}>
        <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{item.text}</Text>
      </View>
    );
  }
  // Assistant: full-width markdown, no gray bubble (desktop-style).
  return (
    <View style={styles.assistantBlock}>
      <MarkdownBody text={item.text} />
    </View>
  );
}

function ThinkingBubble({
  item,
  preferExpanded,
}: {
  item: CursorChatItem;
  preferExpanded: boolean;
}) {
  const [open, setOpen] = useState(preferExpanded);
  useEffect(() => {
    setOpen(preferExpanded);
  }, [preferExpanded]);

  const preview = item.text.trim().replace(/\s+/g, ' ').slice(0, 72);

  return (
    <Pressable style={styles.thinkingRow} onPress={() => setOpen((v) => !v)}>
      <View style={styles.thinkingHeader}>
        <Text style={styles.thinkingLabel}>Thinking</Text>
        <Text style={styles.thinkingChevron}>{open ? '▾' : '▸'}</Text>
      </View>
      {open ? (
        <Text style={styles.thinkingText}>{item.text}</Text>
      ) : preview ? (
        <Text style={styles.thinkingPreview} numberOfLines={1}>
          {preview}
          {item.text.trim().length > 72 ? '…' : ''}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ShellBlock({ text }: { text: string }) {
  const lines = text.replace(/\s+$/, '').split('\n');
  const long = lines.length > 18 || text.length > 1200;
  const [open, setOpen] = useState(!long);
  const command = lines[0]?.startsWith('$') ? lines[0] : null;
  const body = command ? lines.slice(1).join('\n') : text;
  const exitLine = [...lines].reverse().find((l) => /^exit \d+/.test(l.trim()));

  return (
    <Pressable
      style={styles.shellBlock}
      onPress={() => long && setOpen((v) => !v)}
      disabled={!long}
    >
      <View style={styles.shellHeader}>
        <Text style={styles.shellLabel}>Terminal</Text>
        {exitLine ? <Text style={styles.shellExit}>{exitLine.trim()}</Text> : null}
        {long ? (
          <Text style={styles.thinkingChevron}>{open ? '▾' : '▸'}</Text>
        ) : null}
      </View>
      {command ? (
        <Text style={styles.shellCommand} numberOfLines={open ? undefined : 1}>
          {command}
        </Text>
      ) : null}
      {open || !long ? (
        <ScrollView horizontal nestedScrollEnabled>
          <Text style={styles.shellBody} selectable>
            {body || (command ? '' : text)}
          </Text>
        </ScrollView>
      ) : (
        <Text style={styles.shellPreview} numberOfLines={3}>
          {(body || text).trim().replace(/\s+/g, ' ').slice(0, 160)}
          …
        </Text>
      )}
    </Pressable>
  );
}

function ToolGroup({
  chips,
  onOpenPath,
}: {
  chips: ToolChip[];
  onOpenPath?: (path: string) => void;
}) {
  return (
    <View style={styles.toolGroup}>
      {chips.map((chip) => {
        const pathHint = pathFromChip(chip);
        return (
          <Pressable
            key={chip.key}
            disabled={!pathHint || !onOpenPath}
            onPress={() => pathHint && onOpenPath?.(pathHint)}
            style={[
              styles.toolChip,
              chip.state === 'running' && styles.toolChipRunning,
              chip.state === 'error' && styles.toolChipError,
              pathHint && styles.toolChipLink,
            ]}
          >
            <Text style={styles.toolChipText} numberOfLines={2}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Prefer an explicit path-looking detail (edits), not shell command text. */
function pathFromChip(chip: ToolChip): string | null {
  const d = chip.detail?.trim();
  if (!d) return null;
  if (d.includes(' ') || d.includes('\n')) return null;
  if (d.startsWith('/') || d.startsWith('./') || d.includes('/')) return d;
  if (/\.[A-Za-z0-9]{1,8}$/.test(d)) return d;
  return null;
}

function statusColor(status: string) {
  switch (status) {
    case 'running':
    case 'starting':
      return '#34c759';
    case 'error':
      return '#ff453a';
    case 'cancelled':
      return '#ff9f0a';
    case 'finished':
      return '#64d2ff';
    default:
      return '#8e8e93';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'starting':
      return 'Starting';
    case 'running':
      return 'Running';
    case 'finished':
      return 'Finished';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
      return 'Error';
    default:
      return 'Idle';
  }
}

function formatWhen(ms: number) {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return '';
  }
}

/** Folder basename, or `Partners` for `Partners.code-workspace`. */
function workspaceLabel(path: string): string {
  const base = path.split('/').filter(Boolean).pop() || path;
  if (base.toLowerCase().endsWith('.code-workspace')) {
    return base.slice(0, -'.code-workspace'.length) || base;
  }
  return base;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  back: { color: '#64d2ff', fontSize: 17, width: 72 },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  headerTitle: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  headerCwd: {
    textAlign: 'center',
    color: '#8e8e93',
    fontSize: 11,
    marginTop: 1,
    maxWidth: '100%',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 96,
    justifyContent: 'flex-end',
  },
  headerActionBtn: { paddingVertical: 4, paddingHorizontal: 6 },
  headerIcon: { color: '#64d2ff', fontSize: 26, lineHeight: 30 },
  headerBadge: { color: '#aeaeb2', fontSize: 14, fontWeight: '600' },
  gear: { color: '#64d2ff', fontSize: 15, fontWeight: '600' },
  gearDisabled: { opacity: 0.35 },
  attachStrip: { maxHeight: 72, marginBottom: 6 },
  attachStripContent: { gap: 8, paddingHorizontal: 4 },
  attachThumbWrap: { position: 'relative' },
  attachThumb: { width: 56, height: 56, borderRadius: 8 },
  attachRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    color: '#fff',
    backgroundColor: '#ff453a',
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    overflow: 'hidden',
    fontSize: 11,
    lineHeight: 18,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  composerIconBtn: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  composerIcon: { color: '#64d2ff', fontSize: 22, fontWeight: '700' },
  touchedStrip: {
    maxHeight: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2c2c2e',
  },
  touchedStripContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    alignItems: 'center',
  },
  touchedChip: {
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 160,
  },
  touchedChipWrite: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#64d2ff',
  },
  touchedChipText: { color: '#aeaeb2', fontSize: 12, fontFamily: MONO },
  toolChipLink: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#48484a',
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  meta: { color: '#8e8e93', fontSize: 12, flexShrink: 1 },
  statusHint: {
    marginLeft: 'auto',
    color: '#636366',
    fontSize: 12,
  },
  error: {
    color: '#ff453a',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    flexGrow: 1,
  },
  empty: {
    paddingTop: 48,
    paddingHorizontal: 8,
    gap: 10,
    alignItems: 'flex-start',
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  emptyBody: { color: '#8e8e93', fontSize: 14, lineHeight: 20 },
  chip: {
    marginTop: 4,
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: '#fff', fontSize: 13 },
  bubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0a84ff',
  },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  assistantBlock: {
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
  toolGroup: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 2,
  },
  toolChip: {
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  toolChipRunning: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#34c759',
  },
  toolChipError: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ff453a',
  },
  toolChipText: {
    fontFamily: MONO,
    fontSize: 12,
    color: '#aeaeb2',
  },
  thinkingRow: {
    alignSelf: 'stretch',
    backgroundColor: '#141416',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thinkingLabel: { color: '#8e8e93', fontSize: 11, fontWeight: '600' },
  thinkingChevron: { color: '#636366', fontSize: 12 },
  thinkingText: { color: '#aeaeb2', fontSize: 13, lineHeight: 18 },
  thinkingPreview: { color: '#636366', fontSize: 12, lineHeight: 16 },
  shellBlock: {
    alignSelf: 'stretch',
    backgroundColor: '#0c0c0e',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2c2c2e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  shellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shellLabel: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shellExit: {
    marginLeft: 'auto',
    color: '#636366',
    fontFamily: MONO,
    fontSize: 11,
  },
  shellCommand: {
    color: '#64d2ff',
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
  },
  shellBody: {
    color: '#d1d1d6',
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 16,
  },
  shellPreview: {
    color: '#636366',
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 15,
  },
  composer: {
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2c2c2e',
    backgroundColor: C.bg,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#1c1c1e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#0a84ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: {
    backgroundColor: '#3a3a3c',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  cancelLabel: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetDismiss: { flex: 1 },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  sheetDone: { color: '#64d2ff', fontSize: 16 },
  sheetBody: { padding: 16, gap: 8, paddingBottom: 40 },
  section: {
    marginTop: 12,
    marginBottom: 4,
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowText: { color: '#fff', fontSize: 15 },
  rowHint: { color: '#8e8e93', fontSize: 12, marginTop: 2 },
  rowBtn: {
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  rowBtnSelected: {
    borderWidth: 1,
    borderColor: '#0a84ff',
  },
  actionBtn: {
    marginTop: 6,
    backgroundColor: '#2c2c2e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionLabel: { color: '#64d2ff', fontSize: 15, fontWeight: '600' },
  paramBlock: { marginTop: 8, gap: 6 },
  paramRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  paramChip: {
    backgroundColor: '#2c2c2e',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  paramChipOn: { backgroundColor: '#0a84ff' },
  paramChipText: { color: '#fff', fontSize: 12 },
});
