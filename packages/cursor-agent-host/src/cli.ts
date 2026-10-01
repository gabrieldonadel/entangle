/**
 * JSONL Cursor agent host for Entangle.
 *
 * Commands (stdin, one JSON object per line):
 *   { "op": "configure", "apiKey", "cwd", "model", "modelParams?", "statePath" }
 *     `cwd` is the allowlist entry: a folder or a `.code-workspace` file.
 *   { "op": "setModel", "modelId", "params?" }
 *   { "op": "setCwd", "cwd" }  // same: folder or .code-workspace path
 *   { "op": "prompt", "text", "agentId?" }
 *   { "op": "cancel" | "resume" | "snapshot" | "newChat" | "shutdown" }
 *   { "op": "listModels" | "me" | "usage", "agentId?" }
 *   { "op": "listAgents", "cursor?", "limit?" }
 *   { "op": "openAgent", "agentId" }
 *
 * Events (stdout):
 *   { "type": "status", ... }
 *   { "type": "delta", "kind": "assistant"|"thinking"|"tool"|"result", ... }
 *   { "type": "snapshot" | "models" | "usage" | "account" | "agents" | "ready" | "error" }
 */

import { createInterface } from 'node:readline';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  Agent,
  Cursor,
  type ModelParameterValue,
  type Run,
  type SDKAgent,
  type SDKMessage,
  type TokenUsage,
} from '@cursor/sdk';

import {
  extractEditDiffMeta,
  extractShellOutput,
  extractToolDetail,
  formatShellBlock,
  formatToolLine,
  listWorkspaceDir,
  parseShellOutputDelta,
  readWorkspaceFile,
} from './workspace-fs.js';
import {
  clearPending,
  discardPending,
  keepPending,
  pendingPayload,
  recordEditResult,
  snapshotBeforeEdit,
} from './pending-edits.js';
import { resolveWorkspaceRef } from './workspace-ref.js';

type AgentStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'finished'
  | 'error'
  | 'cancelled';

type TranscriptItem = {
  role: 'user' | 'assistant' | 'thinking' | 'tool' | 'shell' | 'result';
  text: string;
};

type PersistedState = {
  agentId?: string;
  cwd?: string;
  workspacePath?: string;
  model?: string;
};

type Config = {
  apiKey: string;
  /** Allowlist entry: folder or `.code-workspace` file. */
  workspacePath: string;
  /** Primary SDK working directory. */
  cwd: string;
  /** Extra multi-root folders (`local.dirs`). */
  dirs: string[];
  name: string;
  model: string;
  modelParams: ModelParameterValue[];
  statePath: string;
};

let config: Config | null = null;
let agent: SDKAgent | null = null;
let currentRun: Run | null = null;
let status: AgentStatus = 'idle';
let runId: string | undefined;
let transcript: TranscriptItem[] = [];

function emit(obj: Record<string, unknown>) {
  const line = `${JSON.stringify(obj)}\n`;
  process.stdout.write(line);
  if (obj.type === 'status' || obj.type === 'error' || obj.type === 'ready') {
    const summary =
      obj.type === 'error'
        ? `error: ${String(obj.message ?? '')}`
        : obj.type === 'ready'
          ? 'ready'
          : `status=${String(obj.status ?? '')}${obj.error ? ` error=${String(obj.error)}` : ''}`;
    process.stderr.write(`[cursor-agent-host] ${summary}\n`);
  }
}

function emitStatus(extra: Record<string, unknown> = {}) {
  emit({
    type: 'status',
    status,
    agentId: agent?.agentId,
    runId,
    // Phone matches allowlist entries against this path (folder or .code-workspace).
    cwd: config?.workspacePath ?? config?.cwd,
    model: config?.model,
    ...extra,
  });
}

function workspaceDirs(): string[] {
  return config?.dirs ?? [];
}

function localAgentOptions() {
  if (!config) throw new Error('Not configured');
  return {
    cwd: config.cwd,
    ...(config.dirs.length ? { dirs: config.dirs } : null),
  };
}

function modelSelection() {
  if (!config) throw new Error('Not configured');
  return {
    id: config.model,
    ...(config.modelParams.length ? { params: config.modelParams } : null),
  };
}

function commonAgentOptions() {
  if (!config) throw new Error('Not configured');
  return {
    apiKey: config.apiKey,
    model: modelSelection(),
    local: localAgentOptions(),
  };
}

function tokenUsagePayload(usage?: TokenUsage | null) {
  if (!usage) return undefined;
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    reasoningTokens: usage.reasoningTokens,
  };
}

async function loadPersisted(): Promise<PersistedState> {
  if (!config?.statePath) return {};
  try {
    const raw = await readFile(config.statePath, 'utf8');
    return JSON.parse(raw) as PersistedState;
  } catch {
    return {};
  }
}

async function savePersisted(next: PersistedState) {
  if (!config?.statePath) return;
  await mkdir(dirname(config.statePath), { recursive: true });
  await writeFile(config.statePath, JSON.stringify(next, null, 2), 'utf8');
}

async function disposeAgent() {
  if (!agent) return;
  try {
    await agent[Symbol.asyncDispose]();
  } catch {
    // ignore dispose failures
  }
  agent = null;
}

function toolLine(msg: SDKMessage): string | null {
  if (msg.type !== 'tool_call') return null;
  const name = typeof msg.name === 'string' && msg.name ? msg.name : 'tool';
  const args = 'args' in msg ? (msg as { args?: unknown }).args : undefined;
  const result = 'result' in msg ? (msg as { result?: unknown }).result : undefined;
  const detail = extractToolDetail(name, args, result);
  return formatToolLine(name, msg.status, detail.detail);
}

function toolShellPayload(msg: SDKMessage): string | null {
  if (msg.type !== 'tool_call') return null;
  const name = typeof msg.name === 'string' && msg.name ? msg.name : 'tool';
  const args = 'args' in msg ? (msg as { args?: unknown }).args : undefined;
  const result = 'result' in msg ? (msg as { result?: unknown }).result : undefined;
  if (msg.status === 'running') {
    const out = extractShellOutput(name, args, undefined);
    if (!out?.command) return null;
    return formatShellBlock(out, { headerOnly: true });
  }
  if (msg.status === 'completed' || msg.status === 'error') {
    const out = extractShellOutput(name, args, result);
    if (!out) return null;
    return formatShellBlock(out);
  }
  return null;
}

function toolFilesPayload(msg: SDKMessage): Record<string, unknown> | null {
  if (msg.type !== 'tool_call') return null;
  const name = typeof msg.name === 'string' && msg.name ? msg.name : 'tool';
  const args = 'args' in msg ? (msg as { args?: unknown }).args : undefined;
  const result = 'result' in msg ? (msg as { result?: unknown }).result : undefined;
  const detail = extractToolDetail(name, args, result);
  if (!detail.files.length) return null;
  return {
    type: 'files',
    files: detail.files,
  };
}

function thinkingText(msg: SDKMessage): string | null {
  if (msg.type !== 'thinking') return null;
  return typeof msg.text === 'string' && msg.text.length ? msg.text : null;
}

function assistantText(msg: SDKMessage): string | null {
  if (msg.type !== 'assistant') return null;
  const content = msg.message?.content;
  if (!content) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && 'text' in block && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }
  return parts.length ? parts.join('') : null;
}

function usageFromStream(msg: SDKMessage): TokenUsage | null {
  if (msg.type !== 'usage') return null;
  return msg.usage ?? null;
}

function extractMessageText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw !== 'object') return '';
  const obj = raw as Record<string, unknown>;
  if (typeof obj.text === 'string') return obj.text;
  if (typeof obj.content === 'string') return obj.content;
  if (Array.isArray(obj.content)) {
    const parts: string[] = [];
    for (const block of obj.content) {
      if (
        block &&
        typeof block === 'object' &&
        (block as { type?: string }).type === 'text' &&
        typeof (block as { text?: string }).text === 'string'
      ) {
        parts.push((block as { text: string }).text);
      }
    }
    return parts.join('');
  }
  if (obj.message && typeof obj.message === 'object') {
    return extractMessageText(obj.message);
  }
  return '';
}

async function createFreshAgent(): Promise<SDKAgent> {
  await disposeAgent();
  agent = await Agent.create(commonAgentOptions());
  await savePersisted({
    agentId: agent.agentId,
    cwd: config!.cwd,
    workspacePath: config!.workspacePath,
    model: config!.model,
  });
  return agent;
}

async function ensureAgent(preferredId?: string): Promise<SDKAgent> {
  if (!config) throw new Error('Not configured');
  const common = commonAgentOptions();

  if (preferredId) {
    if (agent && agent.agentId === preferredId) return agent;
    await disposeAgent();
    try {
      agent = await Agent.resume(preferredId, common);
      await savePersisted({
        agentId: agent.agentId,
        cwd: config.cwd,
        workspacePath: config.workspacePath,
        model: config.model,
      });
      return agent;
    } catch {
      return createFreshAgent();
    }
  }

  if (agent) return agent;

  const persisted = await loadPersisted();
  if (persisted.agentId) {
    try {
      agent = await Agent.resume(persisted.agentId, common);
      await savePersisted({
        agentId: agent.agentId,
        cwd: config.cwd,
        workspacePath: config.workspacePath,
        model: config.model,
      });
      return agent;
    } catch {
      // fall through
    }
  }

  return createFreshAgent();
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${label} timed out after ${Math.round(ms / 1000)}s. Check API key, network, and model.`,
            ),
          );
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function formatRunFailure(result: {
  result?: string;
  error?: { message?: string; code?: string };
}): string {
  const msg = result.error?.message?.trim();
  const code = result.error?.code?.trim();
  if (msg && code) return `${msg} (${code})`;
  if (msg) return msg;
  if (code) return `Run failed (${code})`;
  return (
    'Run failed. If your API key shows Scope: Admin, create a new User API key ' +
    'at cursor.com/dashboard/api (Admin keys are not supported by the Cursor SDK).'
  );
}

function emitSnapshot() {
  emit({
    type: 'snapshot',
    status,
    agentId: agent?.agentId,
    runId,
    cwd: config?.workspacePath ?? config?.cwd,
    model: config?.model,
    transcript,
  });
}

function parseModelParams(raw: unknown): ModelParameterValue[] {
  if (!Array.isArray(raw)) return [];
  const out: ModelParameterValue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = String((item as { id?: unknown }).id ?? '');
    const value = String((item as { value?: unknown }).value ?? '');
    if (id && value) out.push({ id, value });
  }
  return out;
}

async function runPrompt(
  text: string,
  preferredAgentId?: string,
  images?: { data: string; mimeType: string }[],
) {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  if (currentRun) {
    emit({ type: 'error', message: 'A run is already in progress' });
    return;
  }

  status = 'starting';
  emitStatus();
  const userLabel =
    images?.length && text
      ? `${text}\n\n[${images.length} image${images.length === 1 ? '' : 's'} attached]`
      : images?.length
        ? `[${images.length} image${images.length === 1 ? '' : 's'} attached]`
        : text;
  transcript.push({ role: 'user', text: userLabel });

  try {
    let handle: SDKAgent;
    try {
      handle = await withTimeout(
        ensureAgent(preferredAgentId),
        45_000,
        'Starting Cursor agent',
      );
    } catch (first) {
      process.stderr.write(
        `[cursor-agent-host] ensureAgent failed (${first instanceof Error ? first.message : String(first)}); creating fresh agent\n`,
      );
      await disposeAgent();
      await savePersisted({});
      handle = await withTimeout(
        ensureAgent(undefined),
        45_000,
        'Starting Cursor agent (fresh)',
      );
    }
    status = 'running';
    emitStatus();

    let assistantBuf = '';
    let thinkingBuf = '';
    let streamUsage: TokenUsage | undefined;
    /** True once live shell-output-delta chunks arrived for the current tool. */
    let shellLive = false;
    let shellLiveText = '';

    const bumpIdleRef = { current: () => undefined as void };

    const message =
      images?.length
        ? {
            text: text || 'See attached image(s).',
            images: images.map((img) => ({
              data: img.data,
              mimeType: img.mimeType,
            })),
          }
        : text;

    const run = await withTimeout(
      handle.send(message, {
        model: modelSelection(),
        onDelta: ({ update }) => {
          bumpIdleRef.current();
          if (update.type !== 'shell-output-delta') return;
          const parsed = parseShellOutputDelta(update.event);
          if (!parsed?.text) return;
          shellLive = true;
          shellLiveText += parsed.text;
          // Cap live buffer the same way as completed results.
          if (Buffer.byteLength(shellLiveText, 'utf8') > 64_000) {
            shellLiveText = `${shellLiveText.slice(0, 60_000)}\n… (truncated)`;
          }
          const last = transcript[transcript.length - 1];
          if (last?.role === 'shell') {
            last.text += parsed.text;
          } else {
            transcript.push({ role: 'shell', text: parsed.text });
          }
          emit({
            type: 'delta',
            kind: 'shell',
            text: parsed.text,
            agentId: handle.agentId,
            runId: runId ?? '',
          });
        },
      }),
      30_000,
      'Sending prompt',
    );
    currentRun = run;
    runId = run.id;
    emitStatus();

    const stream = run.stream();
    // Idle-based timeout: long tool runs must not die at a fixed 3 minutes.
    // Reset on every stream event; hard cap prevents runaway sessions.
    const streamIdleMs = 600_000; // 10 minutes without events
    const streamMaxMs = 2_700_000; // 45 minutes absolute
    let streamTimedOut = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const tripTimeout = () => {
      if (streamTimedOut) return;
      streamTimedOut = true;
      if (run.supports('cancel')) {
        void run.cancel().catch(() => undefined);
      }
    };
    const bumpIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(tripTimeout, streamIdleMs);
    };
    bumpIdleRef.current = bumpIdle;
    const maxTimer = setTimeout(tripTimeout, streamMaxMs);
    bumpIdle();

    try {
      for await (const event of stream) {
        if (streamTimedOut) break;
        bumpIdle();

        const thinking = thinkingText(event);
        if (thinking) {
          thinkingBuf += thinking;
          emit({
            type: 'delta',
            kind: 'thinking',
            text: thinking,
            agentId: handle.agentId,
            runId: run.id,
          });
        }

        const tool = toolLine(event);
        if (tool) {
          transcript.push({ role: 'tool', text: tool });
          emit({
            type: 'delta',
            kind: 'tool',
            text: tool,
            agentId: handle.agentId,
            runId: run.id,
          });
          const files = toolFilesPayload(event);
          if (files) {
            emit({
              ...files,
              agentId: handle.agentId,
              runId: run.id,
            });
          }

          // Snapshot / review diffs for edit·write·delete tools.
          if (event.type === 'tool_call') {
            void handleEditToolEvent(event, handle.agentId, run.id);
          }

          // Terminal output for shell tools.
          if (event.type === 'tool_call' && event.status === 'running') {
            shellLive = false;
            shellLiveText = '';
            const header = toolShellPayload(event);
            if (header) {
              transcript.push({ role: 'shell', text: header });
              emit({
                type: 'delta',
                kind: 'shell',
                text: header + '\n',
                agentId: handle.agentId,
                runId: run.id,
              });
            }
          } else if (
            event.type === 'tool_call' &&
            (event.status === 'completed' || event.status === 'error')
          ) {
            const full = toolShellPayload(event);
            if (shellLive) {
              // Live chunks already went to the phone; persist + exit footer.
              const footer =
                full && /(?:^|\n)exit \d+\s*$/.test(full)
                  ? `\n${full.match(/(?:^|\n)(exit \d+)\s*$/)?.[1] ?? ''}`
                  : '';
              const combined = (shellLiveText || '') + footer;
              if (combined.trim()) {
                // Replace/append last shell transcript item.
                const last = transcript[transcript.length - 1];
                if (last?.role === 'shell') {
                  last.text = (last.text.endsWith('\n') ? last.text : last.text + '\n') +
                    shellLiveText.replace(/^\n?/, '') +
                    footer;
                } else {
                  transcript.push({ role: 'shell', text: combined });
                }
                if (footer) {
                  emit({
                    type: 'delta',
                    kind: 'shell',
                    text: footer,
                    agentId: handle.agentId,
                    runId: run.id,
                  });
                }
              }
            } else if (full) {
              // No live stream — send the completed block (skip duplicate header).
              const body = full.replace(/^\$[^\n]*\n?/, (m) => {
                const last = transcript[transcript.length - 1];
                if (last?.role === 'shell' && last.text.startsWith('$')) return '';
                return m;
              });
              if (body.trim()) {
                const last = transcript[transcript.length - 1];
                if (last?.role === 'shell') {
                  last.text =
                    (last.text.endsWith('\n') ? last.text : last.text + '\n') + body;
                } else {
                  transcript.push({ role: 'shell', text: full });
                }
                emit({
                  type: 'delta',
                  kind: 'shell',
                  text: body.startsWith('\n') ? body : `\n${body}`,
                  agentId: handle.agentId,
                  runId: run.id,
                });
              }
            }
            shellLive = false;
            shellLiveText = '';
          }
        }

        const chunk = assistantText(event);
        if (chunk) {
          assistantBuf += chunk;
          emit({
            type: 'delta',
            kind: 'assistant',
            text: chunk,
            agentId: handle.agentId,
            runId: run.id,
          });
        }

        const usageMsg = usageFromStream(event);
        if (usageMsg) streamUsage = usageMsg;
      }
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(maxTimer);
    }

    // Always persist streamed buffers on the host so snapshot/resume keep chat.
    if (thinkingBuf) {
      transcript.push({ role: 'thinking', text: thinkingBuf });
      thinkingBuf = '';
    }
    if (assistantBuf) {
      transcript.push({ role: 'assistant', text: assistantBuf });
      assistantBuf = '';
    }

    if (streamTimedOut) {
      const message =
        'Agent stream timed out after no activity. Partial reply is kept — send a follow-up to continue.';
      transcript.push({ role: 'result', text: message });
      emit({
        type: 'delta',
        kind: 'result',
        text: message,
        agentId: handle.agentId,
        runId: run.id,
      });
      status = 'error';
      emitStatus({ error: message });
      emitSnapshot();
      // Keep the agent so resume / follow-ups still work after a timeout.
      return;
    }

    const result = await withTimeout(run.wait(), 120_000, 'Waiting for run result');
    const errorMessage = formatRunFailure(result);
    const resultText =
      typeof result.result === 'string' && result.result.length
        ? result.result
        : result.status === 'finished'
          ? 'Done.'
          : result.status === 'error'
            ? errorMessage
            : `Run ${result.status}`;

    transcript.push({ role: 'result', text: resultText });
    emit({
      type: 'delta',
      kind: 'result',
      text: resultText,
      agentId: handle.agentId,
      runId: run.id,
    });

    const usage = tokenUsagePayload(result.usage ?? streamUsage);
    if (result.status === 'error') {
      status = 'error';
      emitStatus({ error: errorMessage, ...(usage ? { usage } : null) });
    } else if (result.status === 'cancelled') {
      status = 'cancelled';
      emitStatus(usage ? { usage } : {});
    } else {
      status = 'finished';
      emitStatus(usage ? { usage } : {});
    }
    emitSnapshot();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    status = 'error';
    emitStatus({ error: message });
    emit({ type: 'error', message });
    transcript.push({ role: 'result', text: message });
    emit({
      type: 'delta',
      kind: 'result',
      text: message,
      agentId: agent?.agentId ?? '',
      runId: runId ?? '',
    });
    emitSnapshot();
    // Only dispose on hard failures — timeouts are handled above without dispose.
    if (!/timed out after no activity/i.test(message)) {
      await disposeAgent();
    }
  } finally {
    currentRun = null;
  }
}

async function cancelRun() {
  if (!currentRun) {
    emitStatus();
    return;
  }
  try {
    if (currentRun.supports('cancel')) {
      await currentRun.cancel();
    }
    status = 'cancelled';
    emitStatus();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    status = 'error';
    emitStatus({ error: message });
  }
}

async function resumeAgent() {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  try {
    const persisted = await loadPersisted();
    if (!persisted.agentId && !agent) {
      status = 'idle';
      emitStatus();
      emitSnapshot();
      return;
    }
    // Already attached to the requested agent — avoid starting→idle flicker.
    if (agent && (!persisted.agentId || agent.agentId === persisted.agentId)) {
      status = 'idle';
      emitStatus({ agentId: agent.agentId });
      emitSnapshot();
      return;
    }
    status = 'starting';
    emitStatus();
    const handle = await withTimeout(
      ensureAgent(persisted.agentId),
      45_000,
      'Resuming Cursor agent',
    );
    status = 'idle';
    emitStatus({ agentId: handle.agentId });
    emitSnapshot();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await disposeAgent();
    await savePersisted({});
    status = 'idle';
    emitStatus({ error: message });
    emitSnapshot();
  }
}

async function listModels() {
  if (!config?.apiKey) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  try {
    const models = await Cursor.models.list({ apiKey: config.apiKey });
    emit({
      type: 'models',
      models: models.map((m) => ({
        id: m.id,
        displayName: m.displayName || m.id,
        description: m.description ?? '',
        params: (m.parameters ?? []).map((p) => ({
          id: p.id,
          displayName: p.displayName ?? p.id,
          values: (p.values ?? []).map((v) => ({
            id: v.value,
            label: v.displayName ?? v.value,
          })),
        })),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({
      type: 'error',
      message:
        /admin|401|unauthorized|forbidden/i.test(message)
          ? `${message} — Admin API keys are not supported; create a User key at cursor.com/dashboard/api.`
          : message,
    });
  }
}

async function validateKey() {
  if (!config?.apiKey) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  try {
    const me = await Cursor.me({ apiKey: config.apiKey });
    emit({
      type: 'account',
      apiKeyName: me.apiKeyName,
      userEmail: me.userEmail ?? '',
      userId: me.userId ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const friendly =
      /admin|401|unauthorized|forbidden/i.test(message)
        ? `${message} — Admin API keys are not supported by the SDK. Add a User API key (not Scope: Admin).`
        : /feature_unavailable/i.test(message)
          ? 'Account details unavailable for this API key.'
          : message;
    // Emit account (not only error) so phone settings leave "Loading…" even on failure.
    emit({
      type: 'account',
      apiKeyName: '',
      userEmail: '',
      userId: null,
      error: friendly,
    });
  }
}

async function reportUsage(preferredAgentId?: string) {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  try {
    const id = preferredAgentId || agent?.agentId;
    if (!id) {
      emit({
        type: 'usage',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        runs: [],
        error: 'No active chat yet — usage appears after the first finished turn.',
      });
      return;
    }
    const usage = await Agent.getUsage(id, { apiKey: config.apiKey });
    emit({
      type: 'usage',
      agentId: id,
      usage: tokenUsagePayload(usage.usage) ?? {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      costCents: usage.cost?.chargedCents,
      runs: usage.runs.map((r) => ({
        runId: r.runId,
        usage: tokenUsagePayload(r.usage) ?? {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        costCents: r.cost?.chargedCents,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const friendly = /feature_unavailable/i.test(message)
      ? 'Billed usage is unavailable for this API key. Last-turn tokens still show after each run.'
      : /admin|401|unauthorized|forbidden/i.test(message)
        ? `${message} — use a User API key (not Admin).`
        : message;
    // Emit usage (not type:error) so phone settings don't treat this as a chat failure.
    emit({
      type: 'usage',
      agentId: preferredAgentId || agent?.agentId,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      runs: [],
      error: friendly,
    });
  }
}

async function listAgents(cursor?: string, limit?: number) {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  try {
    const result = await Agent.list({
      runtime: 'local',
      cwd: config.cwd,
      limit: limit ?? 30,
      ...(cursor ? { cursor } : null),
    });
    emit({
      type: 'agents',
      items: result.items.map((item) => ({
        agentId: item.agentId,
        name: item.name || item.agentId,
        summary: item.summary || '',
        lastModified: item.lastModified,
        status: item.status,
      })),
      ...(result.nextCursor ? { nextCursor: result.nextCursor } : null),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: 'error', message });
  }
}

async function loadTranscriptForAgent(agentId: string) {
  if (!config) return;
  try {
    const messages = await Agent.messages.list(agentId, {
      runtime: 'local',
      cwd: config.cwd,
      limit: 200,
    });
    const items: TranscriptItem[] = [];
    for (const msg of messages) {
      const text = extractMessageText(msg.message);
      if (!text.trim()) continue;
      if (msg.type === 'user') items.push({ role: 'user', text });
      else if (msg.type === 'assistant') items.push({ role: 'assistant', text });
    }
    transcript = items;
  } catch {
    // Keep existing transcript if message history is unavailable.
  }
}

async function openAgent(agentId: string) {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  const id = agentId.trim();
  if (!id) {
    emit({ type: 'error', message: 'openAgent requires agentId' });
    return;
  }
  try {
    status = 'starting';
    emitStatus();
    await disposeAgent();
    agent = await withTimeout(
      Agent.resume(id, commonAgentOptions()),
      45_000,
      'Opening past chat',
    );
    await savePersisted({
      agentId: agent.agentId,
      cwd: config.cwd,
      workspacePath: config.workspacePath,
      model: config.model,
    });
    await loadTranscriptForAgent(agent.agentId);
    status = 'idle';
    runId = undefined;
    emitStatus({ agentId: agent.agentId });
    emitSnapshot();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    status = 'error';
    emitStatus({ error: message });
    emit({ type: 'error', message });
  }
}

async function newChat() {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  try {
    if (currentRun?.supports('cancel')) {
      await currentRun.cancel().catch(() => undefined);
    }
    currentRun = null;
    await disposeAgent();
    await savePersisted({});
    transcript = [];
    clearPending();
    runId = undefined;
    status = 'idle';
    emitStatus();
    emitSnapshot();
    emit(pendingPayload());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: 'error', message });
  }
}

async function handleEditToolEvent(
  event: Extract<SDKMessage, { type: 'tool_call' }>,
  agentId: string,
  activeRunId: string,
) {
  if (!config) return;
  const name = typeof event.name === 'string' && event.name ? event.name : 'tool';
  const args = 'args' in event ? event.args : undefined;
  const result = 'result' in event ? event.result : undefined;
  const meta = extractEditDiffMeta(name, args, result);
  if (!meta) return;

  if (event.status === 'running') {
    await snapshotBeforeEdit(config.cwd, meta.path, workspaceDirs());
    return;
  }
  if (event.status !== 'completed' && event.status !== 'error') return;

  const entry = await recordEditResult({
    cwd: config.cwd,
    path: meta.path,
    diffString: meta.diffString,
    linesAdded: meta.linesAdded,
    linesRemoved: meta.linesRemoved,
    afterText: meta.isDelete ? '' : meta.afterText,
    extraRoots: workspaceDirs(),
  });
  if (!entry) return;
  emit({
    ...pendingPayload(),
    agentId,
    runId: activeRunId,
  });
}

async function keepEdits(paths?: string[]) {
  const kept = await keepPending(paths);
  emit({
    ...pendingPayload(),
    kept,
  });
}

async function discardEdits(paths?: string[]) {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  const { restored, errors } = await discardPending(config.cwd, paths, workspaceDirs());
  emit({
    ...pendingPayload(),
    discarded: restored,
    ...(errors.length ? { error: errors.join('; ') } : null),
  });
  // Refresh any open file views by re-emitting touched paths as writes.
  if (restored.length) {
    emit({
      type: 'files',
      files: restored.map((path) => ({ path, op: 'write' as const })),
    });
  }
}

async function setModel(modelId: string, paramsRaw: unknown) {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  const id = modelId.trim();
  if (!id) {
    emit({ type: 'error', message: 'setModel requires modelId' });
    return;
  }
  config.model = id;
  config.modelParams = parseModelParams(paramsRaw);
  const persisted = await loadPersisted();
  await savePersisted({
    ...persisted,
    model: config.model,
    cwd: config.cwd,
    workspacePath: config.workspacePath,
  });
  emitStatus();
  emit({ type: 'ready' });
}

/** Switch workspace: folder or `.code-workspace`; drop agent/transcript, keep model + key. */
async function setCwd(cwdRaw: string) {
  if (!config) {
    emit({ type: 'error', message: 'Not configured' });
    return;
  }
  const input = cwdRaw.trim();
  if (!input) {
    emit({ type: 'error', message: 'setCwd requires cwd' });
    return;
  }
  try {
    const resolved = await resolveWorkspaceRef(input);
    // Update roots first so a concurrent listAgents sees the new workspace.
    config.workspacePath = resolved.workspacePath;
    config.cwd = resolved.cwd;
    config.dirs = resolved.dirs;
    config.name = resolved.name;
    if (currentRun?.supports('cancel')) {
      await currentRun.cancel().catch(() => undefined);
    }
    currentRun = null;
    await disposeAgent();
    clearPending();
    transcript = [];
    runId = undefined;
    await savePersisted({
      model: config.model,
      cwd: config.cwd,
      workspacePath: config.workspacePath,
    });
    status = 'idle';
    emitStatus();
    emitSnapshot();
    emit(pendingPayload());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    status = 'error';
    emitStatus({ error: message });
    emit({ type: 'error', message });
  }
}

async function handleLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return;
  let cmd: Record<string, unknown>;
  try {
    cmd = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    emit({ type: 'error', message: 'Invalid JSON command' });
    return;
  }

  const op = cmd.op;
  switch (op) {
    case 'configure': {
      const workspacePath = String(cmd.cwd ?? '').trim();
      const apiKey = String(cmd.apiKey ?? '');
      if (!apiKey || !workspacePath) {
        emit({ type: 'error', message: 'configure requires apiKey and cwd' });
        return;
      }
      try {
        const resolved = await resolveWorkspaceRef(workspacePath);
        config = {
          apiKey,
          workspacePath: resolved.workspacePath,
          cwd: resolved.cwd,
          dirs: resolved.dirs,
          name: resolved.name,
          model: String(cmd.model ?? 'default'),
          modelParams: parseModelParams(cmd.modelParams),
          statePath: String(cmd.statePath ?? ''),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: 'error', message });
        return;
      }
      emit({ type: 'ready' });
      status = 'idle';
      emitStatus();
      void validateKey();
      return;
    }
    case 'setModel':
      await setModel(String(cmd.modelId ?? ''), cmd.params);
      return;
    case 'setCwd':
      await setCwd(String(cmd.cwd ?? ''));
      return;
    case 'listModels':
      await listModels();
      return;
    case 'validateKey':
    case 'me':
      await validateKey();
      return;
    case 'usage':
      await reportUsage(
        typeof cmd.agentId === 'string' ? cmd.agentId : undefined,
      );
      return;
    case 'listAgents':
      await listAgents(
        typeof cmd.cursor === 'string' ? cmd.cursor : undefined,
        typeof cmd.limit === 'number' ? cmd.limit : undefined,
      );
      return;
    case 'openAgent':
      await openAgent(String(cmd.agentId ?? ''));
      return;
    case 'newChat':
      await newChat();
      return;
    case 'prompt': {
      const text = String(cmd.text ?? '').trim();
      const images = Array.isArray(cmd.images)
        ? (cmd.images as unknown[])
            .map((raw) => {
              if (!raw || typeof raw !== 'object') return null;
              const img = raw as { data?: unknown; mimeType?: unknown };
              if (typeof img.data !== 'string' || !img.data) return null;
              if (typeof img.mimeType !== 'string' || !img.mimeType) return null;
              return { data: img.data, mimeType: img.mimeType };
            })
            .filter((x): x is { data: string; mimeType: string } => !!x)
            .slice(0, 4)
        : [];
      if (!text && !images.length) {
        emit({ type: 'error', message: 'prompt requires text or images' });
        return;
      }
      const preferred =
        typeof cmd.agentId === 'string' ? cmd.agentId : undefined;
      await runPrompt(text, preferred, images.length ? images : undefined);
      return;
    }
    case 'cancel':
      await cancelRun();
      return;
    case 'resume':
      await resumeAgent();
      return;
    case 'snapshot':
      emitSnapshot();
      return;
    case 'readFile': {
      if (!config) {
        emit({ type: 'file', path: String(cmd.path ?? ''), error: 'Not configured' });
        return;
      }
      emit(await readWorkspaceFile(config.cwd, String(cmd.path ?? ''), workspaceDirs()));
      return;
    }
    case 'listDir': {
      if (!config) {
        emit({
          type: 'listing',
          path: String(cmd.path ?? '.'),
          entries: [],
          error: 'Not configured',
        });
        return;
      }
      emit(
        await listWorkspaceDir(
          config.cwd,
          typeof cmd.path === 'string' ? cmd.path : '.',
          workspaceDirs(),
        ),
      );
      return;
    }
    case 'listDiffs':
      emit(pendingPayload());
      return;
    case 'keepFiles': {
      const paths = Array.isArray(cmd.paths)
        ? cmd.paths.filter((p): p is string => typeof p === 'string')
        : undefined;
      await keepEdits(paths);
      return;
    }
    case 'discardFiles': {
      const paths = Array.isArray(cmd.paths)
        ? cmd.paths.filter((p): p is string => typeof p === 'string')
        : undefined;
      await discardEdits(paths);
      return;
    }
    case 'shutdown':
      await disposeAgent();
      process.exit(0);
      return;
    default:
      emit({ type: 'error', message: `Unknown op: ${String(op)}` });
  }
}

async function main() {
  emit({ type: 'ready' });
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    try {
      await handleLine(line);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ type: 'error', message });
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  emit({ type: 'error', message });
  process.exit(1);
});
