import EntangleServer, {
  type CursorDeltaPayload,
  type CursorDiffsPayload,
  type CursorErrorPayload,
  type CursorFilesPayload,
  type CursorSnapshotPayload,
  type CursorStatusPayload,
  eventEmitter,
} from 'entangle-server';
import { encode, PROTOCOL_VERSION } from '@entangle/protocol';
import type {
  CursorAgentStatus,
  CursorDeltaKind,
  CursorFileOp,
  CursorPendingDiff,
  CursorTokenUsage,
  CursorTranscriptItem,
  Message,
} from '@entangle/protocol';

/** Phone that last touched Cursor — single-session fan-out target. */
let activeClientId: string | null = null;

function asStatus(value: unknown): CursorAgentStatus {
  switch (value) {
    case 'idle':
    case 'starting':
    case 'running':
    case 'finished':
    case 'error':
    case 'cancelled':
      return value;
    default:
      return 'idle';
  }
}

function asUsage(value: unknown): CursorTokenUsage | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const u = value as Record<string, unknown>;
  return {
    inputTokens: typeof u.inputTokens === 'number' ? u.inputTokens : undefined,
    outputTokens: typeof u.outputTokens === 'number' ? u.outputTokens : undefined,
    totalTokens: typeof u.totalTokens === 'number' ? u.totalTokens : undefined,
    cacheReadTokens: typeof u.cacheReadTokens === 'number' ? u.cacheReadTokens : undefined,
    cacheWriteTokens: typeof u.cacheWriteTokens === 'number' ? u.cacheWriteTokens : undefined,
    reasoningTokens: typeof u.reasoningTokens === 'number' ? u.reasoningTokens : undefined,
  };
}

function asFileOp(value: unknown): CursorFileOp {
  if (value === 'read' || value === 'write' || value === 'other') return value;
  return 'other';
}

function sendStatus(clientId: string, event: CursorStatusPayload) {
  EntangleServer.sendToClient(
    clientId,
    encode({
      v: PROTOCOL_VERSION,
      t: 'cursor.status',
      status: asStatus(event.status),
      agentId: event.agentId,
      runId: event.runId,
      cwd: event.cwd,
      model: event.model,
      error: event.error,
      usage: asUsage(event.usage),
    }),
  );
}

function sendDelta(clientId: string, event: CursorDeltaPayload) {
  const kind = (
    ['assistant', 'thinking', 'tool', 'shell', 'result'].includes(event.kind)
      ? event.kind
      : 'assistant'
  ) as CursorDeltaKind;
  EntangleServer.sendToClient(
    clientId,
    encode({
      v: PROTOCOL_VERSION,
      t: 'cursor.delta',
      kind,
      text: event.text,
      agentId: event.agentId,
      runId: event.runId,
    }),
  );
}

function sendSnapshot(clientId: string, event: CursorSnapshotPayload) {
  const transcript: CursorTranscriptItem[] = (event.transcript ?? []).map((item) => ({
    role:
      item.role === 'user' ||
      item.role === 'assistant' ||
      item.role === 'thinking' ||
      item.role === 'tool' ||
      item.role === 'shell' ||
      item.role === 'result'
        ? item.role
        : 'assistant',
    text: item.text,
  }));
  EntangleServer.sendToClient(
    clientId,
    encode({
      v: PROTOCOL_VERSION,
      t: 'cursor.snapshot',
      status: asStatus(event.status),
      agentId: event.agentId,
      runId: event.runId,
      cwd: event.cwd,
      model: event.model,
      error: event.error,
      transcript,
    }),
  );
}

function sendFiles(clientId: string, event: CursorFilesPayload) {
  const files = (event.files ?? [])
    .map((f) => ({
      path: typeof f.path === 'string' ? f.path : '',
      op: asFileOp(f.op),
    }))
    .filter((f) => f.path);
  if (!files.length) return;
  EntangleServer.sendToClient(
    clientId,
    encode({
      v: PROTOCOL_VERSION,
      t: 'cursor.files',
      files,
      agentId: typeof event.agentId === 'string' ? event.agentId : undefined,
      runId: typeof event.runId === 'string' ? event.runId : undefined,
    }),
  );
}

function sendDiffs(clientId: string, event: CursorDiffsPayload) {
  const files: CursorPendingDiff[] = (event.files ?? [])
    .map((f) => ({
      path: typeof f.path === 'string' ? f.path : '',
      diff: typeof f.diff === 'string' ? f.diff : '',
      linesAdded: typeof f.linesAdded === 'number' ? f.linesAdded : 0,
      linesRemoved: typeof f.linesRemoved === 'number' ? f.linesRemoved : 0,
    }))
    .filter((f) => f.path);
  EntangleServer.sendToClient(
    clientId,
    encode({
      v: PROTOCOL_VERSION,
      t: 'cursor.diffs',
      files,
      agentId: typeof event.agentId === 'string' ? event.agentId : undefined,
      runId: typeof event.runId === 'string' ? event.runId : undefined,
      kept: Array.isArray(event.kept)
        ? event.kept.filter((p): p is string => typeof p === 'string')
        : undefined,
      discarded: Array.isArray(event.discarded)
        ? event.discarded.filter((p): p is string => typeof p === 'string')
        : undefined,
      error: typeof event.error === 'string' ? event.error : undefined,
    }),
  );
}

function fail(clientId: string, message: string) {
  EntangleServer.sendToClient(
    clientId,
    encode({
      v: PROTOCOL_VERSION,
      t: 'cursor.status',
      status: 'error',
      error: message,
    }),
  );
}

export function isCursorCapable(): boolean {
  try {
    return EntangleServer.cursorIsReady();
  } catch {
    return false;
  }
}

const CURSOR_TAGS = new Set([
  'cursor.prompt',
  'cursor.cancel',
  'cursor.resume',
  'cursor.get',
  'cursor.models',
  'cursor.setModel',
  'cursor.usage',
  'cursor.me',
  'cursor.list',
  'cursor.open',
  'cursor.new',
  'cursor.workspaces',
  'cursor.setWorkspace',
  'cursor.file.get',
  'cursor.file.list',
  'cursor.keep',
  'cursor.discard',
  'cursor.diffs',
]);

export function handleCursorMessage(clientId: string, msg: Message): boolean {
  if (!CURSOR_TAGS.has(msg.t)) return false;

  activeClientId = clientId;

  if (!isCursorCapable()) {
    fail(
      clientId,
      'Cursor is not enabled. Set API key, workspace, and Allow phones in Entangle Preferences (Node 22.13+ required).',
    );
    return true;
  }

  if (
    msg.t === 'cursor.prompt' ||
    msg.t === 'cursor.resume' ||
    msg.t === 'cursor.open' ||
    msg.t === 'cursor.new' ||
    msg.t === 'cursor.setWorkspace'
  ) {
    sendStatus(clientId, {
      status: msg.t === 'cursor.new' || msg.t === 'cursor.setWorkspace' ? 'idle' : 'starting',
    });
  }

  void (async () => {
    try {
      switch (msg.t) {
        case 'cursor.prompt': {
          const imagesJson =
            msg.images?.length ? JSON.stringify(msg.images) : null;
          await EntangleServer.cursorPrompt(
            msg.text,
            msg.agentId ?? null,
            imagesJson,
          );
          return;
        }
        case 'cursor.cancel': {
          await EntangleServer.cursorCancel();
          return;
        }
        case 'cursor.resume': {
          await EntangleServer.cursorResume();
          return;
        }
        case 'cursor.get': {
          const snap = await EntangleServer.cursorGetSnapshot();
          sendSnapshot(clientId, snap);
          return;
        }
        case 'cursor.models': {
          const models = await EntangleServer.listCursorModels();
          EntangleServer.sendToClient(
            clientId,
            encode({
              v: PROTOCOL_VERSION,
              t: 'cursor.models',
              models: (models ?? []).map((m: Record<string, unknown>) => ({
                id: String(m.id ?? ''),
                displayName: String(m.displayName ?? m.id ?? ''),
                description: typeof m.description === 'string' ? m.description : undefined,
                params: Array.isArray(m.params)
                  ? (m.params as Record<string, unknown>[]).map((p) => ({
                      id: String(p.id ?? ''),
                      displayName:
                        typeof p.displayName === 'string' ? p.displayName : undefined,
                      values: Array.isArray(p.values)
                        ? (p.values as Record<string, unknown>[]).map((v) => ({
                            id: String(v.id ?? v.value ?? ''),
                            label:
                              typeof v.label === 'string'
                                ? v.label
                                : typeof v.displayName === 'string'
                                  ? v.displayName
                                  : undefined,
                          }))
                        : undefined,
                    }))
                  : undefined,
              })),
            }),
          );
          return;
        }
        case 'cursor.setModel': {
          const paramsJson = msg.params?.length
            ? JSON.stringify(msg.params)
            : '[]';
          await EntangleServer.cursorSetModel(msg.modelId, paramsJson);
          return;
        }
        case 'cursor.usage': {
          try {
            const raw = await EntangleServer.cursorUsage(msg.agentId ?? null);
            EntangleServer.sendToClient(
              clientId,
              encode({
                v: PROTOCOL_VERSION,
                t: 'cursor.usage',
                agentId: typeof raw.agentId === 'string' ? raw.agentId : msg.agentId,
                usage: asUsage(raw.usage) ?? { totalTokens: 0 },
                costCents: typeof raw.costCents === 'number' ? raw.costCents : undefined,
                runs: Array.isArray(raw.runs)
                  ? raw.runs.map((r: Record<string, unknown>) => ({
                      runId: String(r.runId ?? ''),
                      usage: asUsage(r.usage) ?? { totalTokens: 0 },
                      costCents: typeof r.costCents === 'number' ? r.costCents : undefined,
                    }))
                  : undefined,
                error: typeof raw.error === 'string' ? raw.error : undefined,
              }),
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            EntangleServer.sendToClient(
              clientId,
              encode({
                v: PROTOCOL_VERSION,
                t: 'cursor.usage',
                agentId: msg.agentId,
                usage: { totalTokens: 0 },
                error: /feature_unavailable/i.test(message)
                  ? 'Billed usage is unavailable for this API key. Last-turn tokens still show after each run.'
                  : message,
              }),
            );
          }
          return;
        }
        case 'cursor.me': {
          const raw = await EntangleServer.cursorMe();
          EntangleServer.sendToClient(
            clientId,
            encode({
              v: PROTOCOL_VERSION,
              t: 'cursor.account',
              apiKeyName:
                typeof raw.apiKeyName === 'string' && raw.apiKeyName
                  ? raw.apiKeyName
                  : undefined,
              userEmail:
                typeof raw.userEmail === 'string' && raw.userEmail
                  ? raw.userEmail
                  : undefined,
              userId:
                raw.userId === null || typeof raw.userId === 'number'
                  ? raw.userId
                  : undefined,
              error: typeof raw.error === 'string' ? raw.error : undefined,
            }),
          );
          return;
        }
        case 'cursor.list': {
          const raw = await EntangleServer.cursorListAgents(
            msg.cursor ?? null,
            msg.limit ?? null,
          );
          const items = Array.isArray(raw.items) ? raw.items : [];
          EntangleServer.sendToClient(
            clientId,
            encode({
              v: PROTOCOL_VERSION,
              t: 'cursor.agents',
              items: items.map((item: Record<string, unknown>) => ({
                agentId: String(item.agentId ?? ''),
                name: String(item.name ?? item.agentId ?? ''),
                summary: String(item.summary ?? ''),
                lastModified:
                  typeof item.lastModified === 'number' ? item.lastModified : 0,
                status: typeof item.status === 'string' ? item.status : undefined,
              })),
              nextCursor:
                typeof raw.nextCursor === 'string' ? raw.nextCursor : undefined,
            }),
          );
          return;
        }
        case 'cursor.open': {
          await EntangleServer.cursorOpenAgent(msg.agentId);
          return;
        }
        case 'cursor.new': {
          await EntangleServer.cursorNewChat();
          return;
        }
        case 'cursor.workspaces': {
          const raw = EntangleServer.cursorWorkspaces();
          const workspaces = Array.isArray(raw.workspaces) ? raw.workspaces : [];
          EntangleServer.sendToClient(
            clientId,
            encode({
              v: PROTOCOL_VERSION,
              t: 'cursor.workspaces',
              workspaces: workspaces.map(
                (w: { path?: string; name?: string; kind?: string }) => ({
                  path: String(w.path ?? ''),
                  name: String(w.name ?? w.path ?? ''),
                  ...(w.kind === 'code-workspace' || w.kind === 'folder'
                    ? { kind: w.kind }
                    : null),
                }),
              ),
              active: typeof raw.active === 'string' ? raw.active : undefined,
            }),
          );
          return;
        }
        case 'cursor.setWorkspace': {
          await EntangleServer.setActiveCursorWorkspace(msg.path);
          const raw = EntangleServer.cursorWorkspaces();
          const workspaces = Array.isArray(raw.workspaces) ? raw.workspaces : [];
          EntangleServer.sendToClient(
            clientId,
            encode({
              v: PROTOCOL_VERSION,
              t: 'cursor.workspaces',
              workspaces: workspaces.map(
                (w: { path?: string; name?: string; kind?: string }) => ({
                  path: String(w.path ?? ''),
                  name: String(w.name ?? w.path ?? ''),
                  ...(w.kind === 'code-workspace' || w.kind === 'folder'
                    ? { kind: w.kind }
                    : null),
                }),
              ),
              active: typeof raw.active === 'string' ? raw.active : undefined,
            }),
          );
          // Refresh chat list for the new cwd so the phone does not race the host.
          try {
            const agentsRaw = await EntangleServer.cursorListAgents(null, 40);
            const items = Array.isArray(agentsRaw.items) ? agentsRaw.items : [];
            EntangleServer.sendToClient(
              clientId,
              encode({
                v: PROTOCOL_VERSION,
                t: 'cursor.agents',
                items: items.map((item: Record<string, unknown>) => ({
                  agentId: String(item.agentId ?? ''),
                  name: String(item.name ?? item.agentId ?? ''),
                  summary: String(item.summary ?? ''),
                  lastModified:
                    typeof item.lastModified === 'number' ? item.lastModified : 0,
                  status: typeof item.status === 'string' ? item.status : undefined,
                })),
                nextCursor:
                  typeof agentsRaw.nextCursor === 'string'
                    ? agentsRaw.nextCursor
                    : undefined,
              }),
            );
          } catch {
            // Phone can still pull chats via cursor.list.
          }
          return;
        }
        case 'cursor.file.get': {
          const raw = await EntangleServer.cursorReadFile(msg.path);
          EntangleServer.sendToClient(
            clientId,
            encode({
              v: PROTOCOL_VERSION,
              t: 'cursor.file',
              path: String(raw.path ?? msg.path),
              text: typeof raw.text === 'string' ? raw.text : undefined,
              truncated: raw.truncated === true,
              binary: raw.binary === true,
              bytes: typeof raw.bytes === 'number' ? raw.bytes : undefined,
              error: typeof raw.error === 'string' ? raw.error : undefined,
              imageBase64:
                typeof raw.imageBase64 === 'string' ? raw.imageBase64 : undefined,
              mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : undefined,
            }),
          );
          return;
        }
        case 'cursor.file.list': {
          const raw = await EntangleServer.cursorListDir(msg.path ?? null);
          const entries = Array.isArray(raw.entries) ? raw.entries : [];
          EntangleServer.sendToClient(
            clientId,
            encode({
              v: PROTOCOL_VERSION,
              t: 'cursor.file.listing',
              path: String(raw.path ?? msg.path ?? '.'),
              entries: entries.map((e: Record<string, unknown>) => ({
                name: String(e.name ?? ''),
                kind: e.kind === 'dir' ? 'dir' : 'file',
                size: typeof e.size === 'number' ? e.size : undefined,
              })),
              error: typeof raw.error === 'string' ? raw.error : undefined,
            }),
          );
          return;
        }
        case 'cursor.keep': {
          await EntangleServer.cursorKeepFiles(msg.paths ?? null);
          return;
        }
        case 'cursor.discard': {
          await EntangleServer.cursorDiscardFiles(msg.paths ?? null);
          return;
        }
        case 'cursor.diffs': {
          await EntangleServer.cursorListDiffs();
          return;
        }
        default:
          return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (msg.t === 'cursor.me') {
        EntangleServer.sendToClient(
          clientId,
          encode({
            v: PROTOCOL_VERSION,
            t: 'cursor.account',
            error: message,
          }),
        );
        return;
      }
      if (msg.t === 'cursor.file.get') {
        EntangleServer.sendToClient(
          clientId,
          encode({
            v: PROTOCOL_VERSION,
            t: 'cursor.file',
            path: msg.path,
            error: message,
          }),
        );
        return;
      }
      if (msg.t === 'cursor.file.list') {
        EntangleServer.sendToClient(
          clientId,
          encode({
            v: PROTOCOL_VERSION,
            t: 'cursor.file.listing',
            path: msg.path ?? '.',
            entries: [],
            error: message,
          }),
        );
        return;
      }
      fail(clientId, message);
    }
  })();

  return true;
}

export function bindCursorHostEvents() {
  eventEmitter.addListener('cursorStatus', (event: CursorStatusPayload) => {
    const id = activeClientId;
    if (!id) return;
    sendStatus(id, event);
  });
  eventEmitter.addListener('cursorDelta', (event: CursorDeltaPayload) => {
    const id = activeClientId;
    if (!id) return;
    sendDelta(id, event);
  });
  eventEmitter.addListener('cursorSnapshot', (event: CursorSnapshotPayload) => {
    const id = activeClientId;
    if (!id) return;
    sendSnapshot(id, event);
  });
  eventEmitter.addListener('cursorFiles', (event: CursorFilesPayload) => {
    const id = activeClientId;
    if (!id) return;
    sendFiles(id, event);
  });
  eventEmitter.addListener('cursorDiffs', (event: CursorDiffsPayload) => {
    const id = activeClientId;
    if (!id) return;
    sendDiffs(id, event);
  });
  eventEmitter.addListener('cursorError', (event: CursorErrorPayload) => {
    const id = activeClientId;
    if (!id) return;
    fail(id, event.message);
  });
}
