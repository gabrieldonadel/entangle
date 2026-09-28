/**
 * Workspace-scoped file helpers for the Cursor agent host.
 * Paths must resolve under one of the workspace roots (primary cwd + dirs);
 * escapes (including symlink jumps) are rejected.
 */

import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const MAX_FILE_BYTES = 512_000;
/** Images larger than this are treated as non-previewable binaries. */
export const MAX_IMAGE_PREVIEW_BYTES = 512_000;

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};
export const MAX_DIR_ENTRIES = 500;
/** Cap shell output on the wire so a runaway command cannot flood the phone. */
export const MAX_SHELL_BYTES = 64_000;

const PATH_KEYS = new Set([
  'path',
  'file',
  'file_path',
  'filepath',
  'filePath',
  'target',
  'target_file',
  'targetFile',
  'filename',
  'fileName',
]);

const PATH_ARRAY_KEYS = new Set(['paths', 'files', 'file_paths', 'filePaths']);

const WRITE_HINT = /write|edit|apply|patch|create|delete|remove|overwrite|str_replace|search_replace/i;
const READ_HINT = /read|cat|open|view|get/i;
const SHELL_HINT = /shell|bash|zsh|terminal|command|exec|run_terminal/i;

export type FileOp = 'read' | 'write' | 'other';

export type TouchedFile = { path: string; op: FileOp };

export type ToolDetail = {
  name: string;
  detail?: string;
  files: TouchedFile[];
};

function isInside(root: string, abs: string): boolean {
  if (abs === root) return true;
  const prefix = root.endsWith(sep) ? root : root + sep;
  return abs.startsWith(prefix);
}

async function normalizeRoot(root: string): Promise<string> {
  return realpath(root).catch(() => resolve(root));
}

async function resolveAgainstRoot(
  root: string,
  inputPath: string,
): Promise<{ abs: string; rel: string } | { error: string }> {
  const raw = (inputPath || '.').trim() || '.';
  const candidate = isAbsolute(raw) ? resolve(raw) : resolve(root, raw);

  let abs = candidate;
  try {
    abs = await realpath(candidate);
  } catch {
    // Leaf may not exist yet — require the nearest existing ancestor inside root.
    let cursor = dirname(candidate);
    let found: string | null = null;
    for (let i = 0; i < 64; i += 1) {
      try {
        found = await realpath(cursor);
        break;
      } catch {
        const parent = dirname(cursor);
        if (parent === cursor) break;
        cursor = parent;
      }
    }
    if (!found || (!isInside(root, found) && found !== root)) {
      return { error: 'Path is outside the Cursor workspace' };
    }
    abs = candidate;
  }

  if (!isInside(root, abs) && abs !== root) {
    return { error: 'Path is outside the Cursor workspace' };
  }
  const rel = abs === root ? '.' : relative(root, abs);
  return { abs, rel: rel || '.' };
}

/**
 * Resolve a path under the primary cwd, or any extra multi-root folder.
 * Relative paths try each root in order; absolute paths must sit under one root.
 */
export async function resolveUnderRoots(
  roots: string[],
  inputPath: string,
): Promise<{ abs: string; rel: string } | { error: string }> {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const raw of roots) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const root = await normalizeRoot(trimmed);
    if (seen.has(root)) continue;
    seen.add(root);
    normalized.push(root);
  }
  if (!normalized.length) {
    return { error: 'Path is outside the Cursor workspace' };
  }

  const raw = (inputPath || '.').trim() || '.';
  if (isAbsolute(raw)) {
    for (const root of normalized) {
      const hit = await resolveAgainstRoot(root, raw);
      if (!('error' in hit)) return hit;
    }
    return { error: 'Path is outside the Cursor workspace' };
  }

  for (const root of normalized) {
    const hit = await resolveAgainstRoot(root, raw);
    if (!('error' in hit)) return hit;
  }
  return { error: 'Path is outside the Cursor workspace' };
}

export async function resolveUnderCwd(
  cwd: string,
  inputPath: string,
  extraRoots: string[] = [],
): Promise<{ abs: string; rel: string } | { error: string }> {
  return resolveUnderRoots([cwd, ...extraRoots], inputPath);
}

export async function readWorkspaceFile(
  cwd: string,
  inputPath: string,
  extraRoots: string[] = [],
): Promise<Record<string, unknown>> {
  const resolved = await resolveUnderCwd(cwd, inputPath, extraRoots);
  if ('error' in resolved) {
    return { type: 'file', path: inputPath, error: resolved.error };
  }
  try {
    const st = await lstat(resolved.abs);
    if (st.isDirectory()) {
      return {
        type: 'file',
        path: resolved.rel,
        error: 'Path is a directory — use list instead',
      };
    }
    if (st.isSymbolicLink()) {
      // realpath already followed; still reject if somehow a link leaf
    }
    const buf = await readFile(resolved.abs);
    const bytes = buf.byteLength;
    const mime = IMAGE_MIME[extname(resolved.rel).toLowerCase()];
    if (mime && bytes <= MAX_IMAGE_PREVIEW_BYTES) {
      return {
        type: 'file',
        path: resolved.rel,
        binary: true,
        bytes,
        mimeType: mime,
        imageBase64: buf.toString('base64'),
      };
    }
    if (isProbablyBinary(buf) || mime) {
      return {
        type: 'file',
        path: resolved.rel,
        binary: true,
        bytes,
        error: mime
          ? `Image too large to preview (${formatBytes(bytes)}; max ${formatBytes(MAX_IMAGE_PREVIEW_BYTES)})`
          : 'Binary file — cannot preview on phone',
      };
    }
    let text = buf.toString('utf8');
    let truncated = false;
    if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) {
      // Truncate on UTF-8 byte boundary.
      let end = MAX_FILE_BYTES;
      while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
      text = buf.subarray(0, end).toString('utf8');
      truncated = true;
    }
    return {
      type: 'file',
      path: resolved.rel,
      text,
      truncated,
      bytes,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: 'file', path: resolved.rel, error: message };
  }
}

export async function listWorkspaceDir(
  cwd: string,
  inputPath = '.',
  extraRoots: string[] = [],
): Promise<Record<string, unknown>> {
  const resolved = await resolveUnderCwd(cwd, inputPath || '.', extraRoots);
  if ('error' in resolved) {
    return { type: 'listing', path: inputPath || '.', entries: [], error: resolved.error };
  }
  try {
    const st = await lstat(resolved.abs);
    if (!st.isDirectory()) {
      return {
        type: 'listing',
        path: resolved.rel,
        entries: [],
        error: 'Not a directory',
      };
    }
    const names = await readdir(resolved.abs);
    names.sort((a, b) => a.localeCompare(b));
    const entries: { name: string; kind: 'file' | 'dir'; size?: number }[] = [];
    for (const name of names.slice(0, MAX_DIR_ENTRIES)) {
      if (name === '.git' || name === 'node_modules' || name === '.DS_Store') continue;
      try {
        const child = await lstat(join(resolved.abs, name));
        if (child.isDirectory()) {
          entries.push({ name, kind: 'dir' });
        } else {
          entries.push({ name, kind: 'file', size: child.size });
        }
      } catch {
        entries.push({ name, kind: 'file' });
      }
    }
    return { type: 'listing', path: resolved.rel, entries };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      type: 'listing',
      path: resolved.rel,
      entries: [],
      error: message,
    };
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isProbablyBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  if (sample.includes(0)) return true;
  let weird = 0;
  for (const b of sample) {
    if (b < 7 || (b > 13 && b < 32)) weird += 1;
  }
  return weird / Math.max(sample.length, 1) > 0.3;
}

/** Pull path-like strings and a short detail (shell command, etc.) from tool args/result. */
export function extractToolDetail(
  name: string,
  args: unknown,
  result?: unknown,
): ToolDetail {
  const files: TouchedFile[] = [];
  const seen = new Set<string>();
  const op = inferOp(name);
  const collect = (value: unknown, forcedOp?: FileOp) => {
    walk(value, (path) => {
      const cleaned = normalizePath(path);
      if (!cleaned || seen.has(cleaned)) return;
      seen.add(cleaned);
      files.push({ path: cleaned, op: forcedOp ?? op });
    });
  };
  collect(args);
  collect(result, op === 'write' ? 'write' : 'other');

  const detail = pickDetail(name, args);
  return { name, detail, files };
}

function inferOp(name: string): FileOp {
  if (WRITE_HINT.test(name)) return 'write';
  if (READ_HINT.test(name)) return 'read';
  if (SHELL_HINT.test(name)) return 'other';
  return 'other';
}

function pickDetail(name: string, args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const obj = args as Record<string, unknown>;
  const commandKeys = [
    'command',
    'cmd',
    'shell_command',
    'shellCommand',
    'script',
    'input',
    'query',
    'pattern',
    'old_string',
    'new_string',
    'contents',
    'content',
  ];
  for (const key of commandKeys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) {
      const oneLine = v.trim().replace(/\s+/g, ' ');
      return oneLine.length > 160 ? `${oneLine.slice(0, 159)}…` : oneLine;
    }
  }
  // Prefer a path as detail when nothing else.
  for (const key of PATH_KEYS) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return normalizePath(v);
  }
  if (SHELL_HINT.test(name)) return undefined;
  return undefined;
}

function walk(value: unknown, onPath: (path: string) => void, depth = 0) {
  if (depth > 6 || value == null) return;
  if (typeof value === 'string') {
    if (looksLikePath(value)) onPath(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, onPath, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  const obj = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(obj)) {
    if (PATH_KEYS.has(key) && typeof child === 'string') {
      onPath(child);
      continue;
    }
    if (PATH_ARRAY_KEYS.has(key) && Array.isArray(child)) {
      for (const item of child) {
        if (typeof item === 'string') onPath(item);
        else if (item && typeof item === 'object') {
          const p = (item as { path?: unknown }).path;
          if (typeof p === 'string') onPath(p);
        }
      }
      continue;
    }
    walk(child, onPath, depth + 1);
  }
}

function looksLikePath(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 512) return false;
  if (t.includes('\n') || t.includes(' ')) return false;
  if (t.startsWith('/') || t.startsWith('./') || t.startsWith('../')) return true;
  if (/^[A-Za-z]:[\\/]/.test(t)) return true;
  return /^[\w.@+=-]+(?:\/[\w.@+=-]+)+$/.test(t);
}

function normalizePath(raw: string): string {
  return raw.trim().replace(/^\.\//, '');
}

export function formatToolLine(
  name: string,
  status: string | undefined,
  detail?: string,
): string {
  const label = detail ? `${name}: ${detail}` : name;
  if (status === 'running') return `Running ${label}…`;
  if (status === 'error') return `${label} failed`;
  return `Ran ${label}`;
}

export type ShellOutput = {
  command?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
};

/** Pull stdout/stderr/exitCode from a completed shell-like tool_call result. */
export function extractShellOutput(
  name: string,
  args: unknown,
  result: unknown,
): ShellOutput | null {
  const command = pickCommand(args);
  const isShell = SHELL_HINT.test(name) || !!command;
  if (!isShell && !looksLikeShellResult(result)) return null;

  const out: ShellOutput = {};
  if (command) out.command = command;

  if (result == null) {
    return command ? out : null;
  }

  if (typeof result === 'string') {
    out.stdout = truncateShell(result);
    return out;
  }

  if (typeof result !== 'object') return command ? out : null;
  const obj = result as Record<string, unknown>;

  // ShellToolCallSchema: { status: 'success', value: { stdout, stderr, exitCode } }
  const value =
    obj.value && typeof obj.value === 'object'
      ? (obj.value as Record<string, unknown>)
      : obj.result && typeof obj.result === 'object'
        ? (obj.result as Record<string, unknown>)
        : obj;

  if (typeof value.stdout === 'string') out.stdout = truncateShell(value.stdout);
  if (typeof value.stderr === 'string') out.stderr = truncateShell(value.stderr);
  if (typeof value.exitCode === 'number') out.exitCode = value.exitCode;
  else if (typeof value.exit_code === 'number') out.exitCode = value.exit_code as number;
  else if (typeof value.code === 'number') out.exitCode = value.code as number;

  if (obj.status === 'error') {
    const err = obj.error;
    out.error =
      typeof err === 'string'
        ? err
        : err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Shell command failed';
  }

  if (
    out.stdout == null &&
    out.stderr == null &&
    out.exitCode == null &&
    out.error == null &&
    !command
  ) {
    return null;
  }
  return out;
}

/** Format a terminal block for the phone transcript. */
export function formatShellBlock(out: ShellOutput, opts?: { headerOnly?: boolean }): string {
  const lines: string[] = [];
  if (out.command) lines.push(`$ ${out.command}`);
  if (opts?.headerOnly) return lines.join('\n') || '$';

  if (out.stdout) lines.push(out.stdout.replace(/\s+$/, ''));
  if (out.stderr) {
    const err = out.stderr.replace(/\s+$/, '');
    if (err) lines.push(err);
  }
  if (out.error) lines.push(out.error);
  if (typeof out.exitCode === 'number') lines.push(`exit ${out.exitCode}`);
  return lines.join('\n');
}

/** Best-effort parse of opaque `shell-output-delta` event payloads. */
export function parseShellOutputDelta(event: unknown): { stream: 'stdout' | 'stderr'; text: string } | null {
  if (event == null) return null;
  if (typeof event === 'string' && event.length) {
    return { stream: 'stdout', text: event };
  }
  if (typeof event !== 'object') return null;
  const obj = event as Record<string, unknown>;

  const streamRaw = String(obj.stream ?? obj.channel ?? obj.fd ?? obj.type ?? 'stdout').toLowerCase();
  const stream: 'stdout' | 'stderr' =
    streamRaw.includes('err') || streamRaw === '2' ? 'stderr' : 'stdout';

  const textCandidates = [obj.data, obj.text, obj.chunk, obj.output, obj.stdout, obj.stderr, obj.delta];
  for (const c of textCandidates) {
    if (typeof c === 'string' && c.length) return { stream, text: c };
  }
  // Nested { event: { data } } already unwrapped by caller usually.
  if (obj.event && typeof obj.event === 'object') {
    return parseShellOutputDelta(obj.event);
  }
  return null;
}

function pickCommand(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const obj = args as Record<string, unknown>;
  for (const key of ['command', 'cmd', 'shell_command', 'shellCommand', 'script']) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) {
      const oneLine = v.trim().replace(/\s+/g, ' ');
      return oneLine.length > 200 ? `${oneLine.slice(0, 199)}…` : oneLine;
    }
  }
  return undefined;
}

function looksLikeShellResult(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const obj = result as Record<string, unknown>;
  const value =
    obj.value && typeof obj.value === 'object'
      ? (obj.value as Record<string, unknown>)
      : obj;
  return (
    typeof value.stdout === 'string' ||
    typeof value.stderr === 'string' ||
    typeof value.exitCode === 'number'
  );
}

function truncateShell(text: string): string {
  if (Buffer.byteLength(text, 'utf8') <= MAX_SHELL_BYTES) return text;
  let end = MAX_SHELL_BYTES;
  const buf = Buffer.from(text, 'utf8');
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
  return `${buf.subarray(0, end).toString('utf8')}\n… (truncated)`;
}

/** Minimal unified diff for review UI when the SDK does not supply diffString. */
export function formatUnifiedDiff(
  path: string,
  before: string,
  after: string,
): { diff: string; linesAdded: number; linesRemoved: number } {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  // Drop trailing empty line from split of files ending in newline.
  if (a.length && a[a.length - 1] === '') a.pop();
  if (b.length && b[b.length - 1] === '') b.pop();

  const lines: string[] = [`--- a/${path}`, `+++ b/${path}`, `@@ -1,${a.length} +1,${b.length} @@`];
  let added = 0;
  let removed = 0;

  // Patience-free LCS via simple Myers-ish O(n*m) for small files; fall back to
  // all-delete/all-add when either side is huge.
  if (a.length * b.length > 250_000) {
    for (const line of a) {
      lines.push(`-${line}`);
      removed += 1;
    }
    for (const line of b) {
      lines.push(`+${line}`);
      added += 1;
    }
    return { diff: lines.join('\n'), linesAdded: added, linesRemoved: removed };
  }

  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push(`-${a[i]}`);
      removed += 1;
      i += 1;
    } else {
      lines.push(`+${b[j]}`);
      added += 1;
      j += 1;
    }
  }
  while (i < n) {
    lines.push(`-${a[i++]}`);
    removed += 1;
  }
  while (j < m) {
    lines.push(`+${b[j++]}`);
    added += 1;
  }
  return { diff: lines.join('\n'), linesAdded: added, linesRemoved: removed };
}

/** Pull path + diff metadata from an edit/write/delete tool_call. */
export function extractEditDiffMeta(
  name: string,
  args: unknown,
  result: unknown,
): {
  path: string;
  diffString?: string;
  linesAdded?: number;
  linesRemoved?: number;
  afterText?: string;
  isDelete?: boolean;
} | null {
  if (!WRITE_HINT.test(name) && !/delete|remove/i.test(name)) return null;
  const path = pickPath(args) || pickPath(result);
  if (!path) return null;

  const out: {
    path: string;
    diffString?: string;
    linesAdded?: number;
    linesRemoved?: number;
    afterText?: string;
    isDelete?: boolean;
  } = { path };

  if (/delete|remove/i.test(name)) out.isDelete = true;

  if (args && typeof args === 'object') {
    const a = args as Record<string, unknown>;
    if (typeof a.fileText === 'string') out.afterText = a.fileText;
    if (typeof a.contents === 'string') out.afterText = a.contents;
    if (typeof a.content === 'string') out.afterText = a.content;
  }

  const value = unwrapResultValue(result);
  if (value) {
    if (typeof value.diffString === 'string') out.diffString = value.diffString;
    if (typeof value.linesAdded === 'number') out.linesAdded = value.linesAdded;
    if (typeof value.linesRemoved === 'number') out.linesRemoved = value.linesRemoved;
    if (typeof value.fileContentAfterWrite === 'string') {
      out.afterText = value.fileContentAfterWrite;
    }
  }
  return out;
}

function pickPath(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  for (const key of PATH_KEYS) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return normalizePath(v);
  }
  if (obj.value && typeof obj.value === 'object') {
    return pickPath(obj.value);
  }
  return undefined;
}

function unwrapResultValue(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== 'object') return null;
  const obj = result as Record<string, unknown>;
  if (obj.value && typeof obj.value === 'object') return obj.value as Record<string, unknown>;
  return obj;
}
