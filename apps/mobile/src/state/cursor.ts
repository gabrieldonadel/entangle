import { create } from 'zustand';
import { Share, Platform } from 'react-native';

import {
  PROTOCOL_VERSION,
  type CursorAgentListItem,
  type CursorAgentStatus,
  type CursorDeltaKind,
  type CursorDirEntryKind,
  type CursorFileOp,
  type CursorModelInfo,
  type CursorPendingDiff,
  type CursorTokenUsage,
  type CursorTranscriptItem,
  type CursorWorkspaceInfo,
} from '@entangle/protocol';

import { getSocket } from '@/net/socket';
import { sendMessage } from '@/net/send';

import type { ConnectionTarget } from './connection';

export type CursorChatItem = {
  id: string;
  role: 'user' | 'assistant' | 'thinking' | 'tool' | 'shell' | 'result';
  text: string;
};

export type CursorAccount = {
  apiKeyName?: string;
  userEmail?: string;
  error?: string;
};

export type CursorUsageState = {
  agentId?: string;
  usage: CursorTokenUsage;
  costCents?: number;
  runs?: { runId: string; usage: CursorTokenUsage; costCents?: number }[];
  error?: string;
};

export type TouchedFile = {
  path: string;
  op: CursorFileOp;
};

export type DirEntry = {
  name: string;
  kind: CursorDirEntryKind;
  size?: number;
};

export type FileViewState = {
  /** Directory currently listed (workspace-relative). */
  listPath: string;
  entries: DirEntry[];
  listError: string | null;
  /** Open file path, or null when browsing. */
  filePath: string | null;
  text: string | null;
  truncated: boolean;
  binary: boolean;
  bytes: number | null;
  fileError: string | null;
  loading: boolean;
  imageBase64: string | null;
  mimeType: string | null;
};

interface CursorState {
  status: CursorAgentStatus;
  agentId: string | null;
  runId: string | null;
  cwd: string | null;
  model: string | null;
  error: string | null;
  items: CursorChatItem[];
  lastTurnUsage: CursorTokenUsage | null;
  models: CursorModelInfo[];
  modelParams: { id: string; value: string }[];
  agents: CursorAgentListItem[];
  agentsNextCursor: string | null;
  /** Allowlisted workspaces from the Mac; phone may switch among these. */
  workspaces: CursorWorkspaceInfo[];
  account: CursorAccount | null;
  usage: CursorUsageState | null;
  /** Recent paths the agent touched this session (newest last). */
  touchedFiles: TouchedFile[];
  /** Pending edits awaiting Keep / Discard review. */
  pendingDiffs: CursorPendingDiff[];
  fileView: FileViewState;
  applyStatus: (msg: {
    status: CursorAgentStatus;
    agentId?: string;
    runId?: string;
    cwd?: string;
    model?: string;
    error?: string;
    usage?: CursorTokenUsage;
  }) => void;
  applyDelta: (msg: {
    kind: CursorDeltaKind;
    text: string;
    agentId: string;
    runId: string;
  }) => void;
  applySnapshot: (msg: {
    status: CursorAgentStatus;
    agentId?: string;
    runId?: string;
    cwd?: string;
    model?: string;
    error?: string;
    transcript: CursorTranscriptItem[];
  }) => void;
  applyModels: (models: CursorModelInfo[]) => void;
  applyAgents: (
    items: CursorAgentListItem[],
    nextCursor?: string,
    opts?: { append?: boolean },
  ) => void;
  applyWorkspaces: (workspaces: CursorWorkspaceInfo[], active?: string) => void;
  applyAccount: (account: CursorAccount) => void;
  applyUsage: (usage: CursorUsageState) => void;
  applyFiles: (files: TouchedFile[]) => void;
  applyDiffs: (msg: {
    files: CursorPendingDiff[];
    kept?: string[];
    discarded?: string[];
    error?: string;
  }) => void;
  applyFile: (msg: {
    path: string;
    text?: string;
    truncated?: boolean;
    binary?: boolean;
    bytes?: number;
    error?: string;
    imageBase64?: string;
    mimeType?: string;
  }) => void;
  applyListing: (msg: {
    path: string;
    entries: DirEntry[];
    error?: string;
  }) => void;
  reset: () => void;
  prompt: (
    text: string,
    opts?: { images?: { data: string; mimeType: string }[] },
  ) => void;
  cancel: () => void;
  resume: () => void;
  requestSnapshot: () => void;
  fetchModels: () => void;
  setModel: (modelId: string, params?: { id: string; value: string }[]) => void;
  fetchUsage: () => void;
  fetchAccount: () => void;
  fetchAgents: () => void;
  fetchMoreAgents: () => void;
  fetchWorkspaces: () => void;
  setWorkspace: (path: string) => void;
  openAgent: (agentId: string) => void;
  newChat: () => void;
  listDir: (path?: string) => void;
  getFile: (path: string) => void;
  clearFileView: () => void;
  fetchDiffs: () => void;
  keepFiles: (paths?: string[]) => void;
  discardFiles: (paths?: string[]) => void;
  copyTranscript: () => Promise<void>;
  shareTranscript: () => Promise<void>;
}

const EMPTY_FILE_VIEW: FileViewState = {
  listPath: '.',
  entries: [],
  listError: null,
  filePath: null,
  text: null,
  truncated: false,
  binary: false,
  bytes: null,
  fileError: null,
  loading: false,
  imageBase64: null,
  mimeType: null,
};

let seq = 0;
function nextId() {
  seq += 1;
  return `c-${seq}`;
}

let busyWatchdog: ReturnType<typeof setTimeout> | null = null;
/** Must exceed host stream idle timeout so the phone does not give up first. */
const BUSY_TIMEOUT_MS = 700_000;

function clearBusyWatchdog() {
  if (busyWatchdog) {
    clearTimeout(busyWatchdog);
    busyWatchdog = null;
  }
}

function armBusyWatchdog() {
  clearBusyWatchdog();
  busyWatchdog = setTimeout(() => {
    busyWatchdog = null;
    const { status } = useCursor.getState();
    if (status !== 'starting' && status !== 'running') return;
    useCursor.setState({
      status: 'error',
      error:
        'No response from the Mac agent after ~12 minutes. Check Entangle Preferences → Cursor (Ready / model), then retry.',
    });
  }, BUSY_TIMEOUT_MS);
}

function socketOpen(): boolean {
  const ws = getSocket();
  return !!ws && ws.readyState === WebSocket.OPEN;
}

function transcriptText(items: CursorChatItem[]): string {
  return items
    .map((item) => {
      const label =
        item.role === 'user'
          ? 'You'
          : item.role === 'assistant'
            ? 'Cursor'
            : item.role === 'thinking'
              ? 'Thinking'
              : item.role === 'tool'
                ? 'Tool'
                : item.role === 'shell'
                  ? 'Shell'
                  : 'Result';
      return `${label}:\n${item.text}`;
    })
    .join('\n\n');
}

export const useCursor = create<CursorState>((set, get) => ({
  status: 'idle',
  agentId: null,
  runId: null,
  cwd: null,
  model: null,
  error: null,
  items: [],
  lastTurnUsage: null,
  models: [],
  modelParams: [],
  agents: [],
  agentsNextCursor: null,
  workspaces: [],
  account: null,
  usage: null,
  touchedFiles: [],
  pendingDiffs: [],
  fileView: { ...EMPTY_FILE_VIEW },
  applyStatus: (msg) => {
    if (msg.status === 'starting' || msg.status === 'running') {
      armBusyWatchdog();
    } else {
      clearBusyWatchdog();
    }
    set({
      status: msg.status,
      agentId: msg.agentId ?? get().agentId,
      runId: msg.runId ?? get().runId,
      cwd: msg.cwd ?? get().cwd,
      model: msg.model ?? get().model,
      error: msg.error ?? null,
      lastTurnUsage: msg.usage ?? get().lastTurnUsage,
    });
  },
  applyDelta: (msg) => {
    armBusyWatchdog();
    set((state) => {
      const items = [...state.items];
      if (msg.kind === 'assistant' || msg.kind === 'thinking' || msg.kind === 'shell') {
        const last = items[items.length - 1];
        if (last && last.role === msg.kind) {
          items[items.length - 1] = { ...last, text: last.text + msg.text };
        } else {
          items.push({ id: nextId(), role: msg.kind, text: msg.text });
        }
      } else if (msg.kind === 'tool') {
        items.push({ id: nextId(), role: 'tool', text: msg.text });
      } else {
        items.push({ id: nextId(), role: 'result', text: msg.text });
      }
      return {
        items,
        agentId: msg.agentId,
        runId: msg.runId,
      };
    });
  },
  applySnapshot: (msg) => {
    if (msg.status === 'starting' || msg.status === 'running') {
      armBusyWatchdog();
    } else {
      clearBusyWatchdog();
    }
    set((state) => {
      const incoming = msg.transcript ?? [];
      const cwdChanged = !!msg.cwd && msg.cwd !== state.cwd;
      // Hot restart / empty host snapshot must not wipe a transcript we already have —
      // unless the workspace changed (empty chat for the new cwd is correct).
      const items =
        incoming.length > 0
          ? incoming.map((item) => ({
              id: nextId(),
              role: item.role,
              text: item.text,
            }))
          : cwdChanged
            ? []
            : state.items;
      return {
        status: msg.status,
        agentId: msg.agentId ?? null,
        runId: msg.runId ?? null,
        cwd: msg.cwd ?? state.cwd,
        model: msg.model ?? state.model,
        error: msg.error ?? null,
        items,
      };
    });
  },
  applyModels: (models) => set({ models }),
  applyAgents: (items, nextCursor, opts) =>
    set((state) => {
      const merged = opts?.append
        ? [
            ...state.agents,
            ...items.filter(
              (item) => !state.agents.some((a) => a.agentId === item.agentId),
            ),
          ]
        : items;
      return {
        agents: merged,
        agentsNextCursor: nextCursor ?? null,
      };
    }),
  applyWorkspaces: (workspaces, active) =>
    set((state) => ({
      workspaces,
      cwd: active ?? state.cwd,
    })),
  applyAccount: (account) => set({ account }),
  applyUsage: (usage) => set({ usage }),
  applyFiles: (files) => {
    if (!files.length) return;
    set((state) => {
      const byPath = new Map(state.touchedFiles.map((f) => [f.path, f]));
      for (const f of files) {
        if (!f.path) continue;
        byPath.set(f.path, { path: f.path, op: f.op || 'other' });
      }
      const touchedFiles = [...byPath.values()].slice(-40);
      const lastWrite = [...files].reverse().find((f) => f.op === 'write');
      // Auto-refresh an open file when the agent rewrites it.
      if (
        lastWrite &&
        state.fileView.filePath &&
        state.fileView.filePath === lastWrite.path
      ) {
        sendMessage({
          v: PROTOCOL_VERSION,
          t: 'cursor.file.get',
          path: lastWrite.path,
        });
      }
      return { touchedFiles };
    });
  },
  applyDiffs: (msg) => {
    set({
      pendingDiffs: msg.files ?? [],
      ...(msg.error
        ? { error: msg.error }
        : msg.discarded?.length
          ? { error: null }
          : null),
    });
  },
  applyFile: (msg) => {
    set((state) => ({
      fileView: {
        ...state.fileView,
        loading: false,
        filePath: msg.path,
        text: msg.text ?? null,
        truncated: !!msg.truncated,
        binary: !!msg.binary,
        bytes: typeof msg.bytes === 'number' ? msg.bytes : null,
        fileError: msg.error ?? null,
        imageBase64: msg.imageBase64 ?? null,
        mimeType: msg.mimeType ?? null,
      },
    }));
  },
  applyListing: (msg) => {
    set((state) => ({
      fileView: {
        ...state.fileView,
        loading: false,
        listPath: msg.path || '.',
        entries: msg.entries ?? [],
        listError: msg.error ?? null,
        // Stay in browse mode unless a file is already open.
        filePath: state.fileView.filePath,
      },
    }));
  },
  reset: () => {
    clearBusyWatchdog();
    set({
      status: 'idle',
      agentId: null,
      runId: null,
      cwd: null,
      model: null,
      error: null,
      items: [],
      lastTurnUsage: null,
      models: [],
      modelParams: [],
      agents: [],
      agentsNextCursor: null,
      workspaces: [],
      account: null,
      usage: null,
      touchedFiles: [],
      pendingDiffs: [],
      fileView: { ...EMPTY_FILE_VIEW },
    });
  },
  prompt: (text, opts) => {
    const trimmed = text.trim();
    const images = (opts?.images ?? []).slice(0, 4);
    if (!trimmed && !images.length) return;
    if (!socketOpen()) {
      // Lazy require avoids a cycle: connection.ts already imports this store.
      const { useConnection } = require('./connection') as typeof import('./connection');
      const { phase, target } = useConnection.getState() as {
        phase: string;
        target: ConnectionTarget | null;
      };
      if (target && phase !== 'idle') {
        set({
          status: 'error',
          error: 'Connection to the Mac dropped. Reconnecting…',
        });
        // Nudge the reconnect loop; Bonjour will refresh the port if the Mac restarted.
        if (phase !== 'connecting' && phase !== 'reconnecting') {
          useConnection.getState().connect(target);
        }
        return;
      }
      set({
        status: 'error',
        error: 'Not connected to the Mac. Reconnect from the Connect screen.',
      });
      return;
    }
    const display =
      images.length && trimmed
        ? `${trimmed}\n\n[${images.length} image${images.length === 1 ? '' : 's'} attached]`
        : images.length
          ? `[${images.length} image${images.length === 1 ? '' : 's'} attached]`
          : trimmed;
    const { agentId } = get();
    set((state) => ({
      items: [...state.items, { id: nextId(), role: 'user', text: display }],
      status: 'starting',
      error: null,
    }));
    armBusyWatchdog();
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.prompt',
      text: trimmed || 'See attached image(s).',
      ...(agentId ? { agentId } : null),
      ...(images.length ? { images } : null),
    });
  },
  cancel: () => {
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.cancel' });
  },
  resume: () => {
    if (!socketOpen()) return;
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.resume' });
  },
  requestSnapshot: () => {
    if (!socketOpen()) return;
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.get' });
  },
  fetchModels: () => {
    if (!socketOpen()) return;
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.models' });
  },
  setModel: (modelId, params) => {
    if (!socketOpen()) return;
    set({
      model: modelId,
      modelParams: params ?? [],
    });
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.setModel',
      modelId,
      ...(params?.length ? { params } : null),
    });
  },
  fetchUsage: () => {
    if (!socketOpen()) return;
    const { agentId } = get();
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.usage',
      ...(agentId ? { agentId } : null),
    });
  },
  fetchAccount: () => {
    if (!socketOpen()) return;
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.me' });
  },
  fetchAgents: () => {
    if (!socketOpen()) return;
    set({ agents: [], agentsNextCursor: null });
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.list', limit: 40 });
  },
  fetchMoreAgents: () => {
    if (!socketOpen()) return;
    const cursor = get().agentsNextCursor;
    if (!cursor) return;
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.list',
      limit: 40,
      cursor,
    });
  },
  fetchWorkspaces: () => {
    if (!socketOpen()) return;
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.workspaces' });
  },
  setWorkspace: (path) => {
    if (!socketOpen()) return;
    const trimmed = path.trim();
    if (!trimmed) return;
    const { cwd } = get();
    if (cwd === trimmed) return;
    clearBusyWatchdog();
    set({
      status: 'idle',
      agentId: null,
      runId: null,
      cwd: trimmed,
      error: null,
      items: [],
      agents: [],
      agentsNextCursor: null,
      lastTurnUsage: null,
      touchedFiles: [],
      pendingDiffs: [],
      fileView: { ...EMPTY_FILE_VIEW },
      usage: null,
    });
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.setWorkspace',
      path: trimmed,
    });
  },
  openAgent: (agentId) => {
    if (!socketOpen()) return;
    set({ status: 'starting', error: null, items: [] });
    armBusyWatchdog();
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.open', agentId });
  },
  newChat: () => {
    if (!socketOpen()) return;
    clearBusyWatchdog();
    set({
      status: 'idle',
      agentId: null,
      runId: null,
      error: null,
      items: [],
      lastTurnUsage: null,
      touchedFiles: [],
      pendingDiffs: [],
    });
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.new' });
  },
  listDir: (path) => {
    if (!socketOpen()) return;
    set((state) => ({
      fileView: {
        ...state.fileView,
        loading: true,
        listError: null,
        filePath: null,
        text: null,
        fileError: null,
        imageBase64: null,
        mimeType: null,
        listPath: path?.trim() || state.fileView.listPath || '.',
      },
    }));
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.file.list',
      ...(path?.trim() ? { path: path.trim() } : null),
    });
  },
  getFile: (path) => {
    const trimmed = path.trim();
    if (!trimmed || !socketOpen()) return;
    set((state) => ({
      fileView: {
        ...state.fileView,
        loading: true,
        filePath: trimmed,
        text: null,
        fileError: null,
        truncated: false,
        binary: false,
        bytes: null,
        imageBase64: null,
        mimeType: null,
      },
    }));
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.file.get',
      path: trimmed,
    });
  },
  clearFileView: () => {
    set({ fileView: { ...EMPTY_FILE_VIEW } });
  },
  fetchDiffs: () => {
    if (!socketOpen()) return;
    sendMessage({ v: PROTOCOL_VERSION, t: 'cursor.diffs' });
  },
  keepFiles: (paths) => {
    if (!socketOpen()) return;
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.keep',
      ...(paths?.length ? { paths } : null),
    });
  },
  discardFiles: (paths) => {
    if (!socketOpen()) return;
    sendMessage({
      v: PROTOCOL_VERSION,
      t: 'cursor.discard',
      ...(paths?.length ? { paths } : null),
    });
  },
  copyTranscript: async () => {
    const text = transcriptText(get().items);
    if (!text) return;
    await Share.share(
      Platform.OS === 'ios' ? { message: text } : { message: text, title: 'Cursor chat' },
    );
  },
  shareTranscript: async () => {
    const text = transcriptText(get().items);
    if (!text) return;
    await Share.share(
      Platform.OS === 'ios' ? { message: text } : { message: text, title: 'Cursor chat' },
    );
  },
}));
