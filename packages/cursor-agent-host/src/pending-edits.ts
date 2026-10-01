/**
 * Track agent file edits so the phone can review (diff) and keep/discard.
 * Local SDK agents write to disk immediately — discard restores pre-edit snapshots.
 */

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  formatUnifiedDiff,
  readWorkspaceFile,
  resolveUnderCwd,
} from './workspace-fs.js';

export type PendingEdit = {
  path: string;
  /** Content before the edit; null means the file did not exist (new file). */
  before: string | null;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
};

const pending = new Map<string, PendingEdit>();
/** Snapshots taken when an edit/write/delete tool starts running. */
const inflight = new Map<string, string | null>();

export function listPending(): PendingEdit[] {
  return [...pending.values()];
}

export function pendingPayload() {
  return {
    type: 'diffs' as const,
    files: listPending().map((p) => ({
      path: p.path,
      diff: p.diff,
      linesAdded: p.linesAdded,
      linesRemoved: p.linesRemoved,
    })),
  };
}

export async function snapshotBeforeEdit(
  cwd: string,
  inputPath: string,
  extraRoots: string[] = [],
) {
  const resolved = await resolveUnderCwd(cwd, inputPath, extraRoots);
  if ('error' in resolved) return;
  const file = await readWorkspaceFile(cwd, resolved.rel, extraRoots);
  const before =
    typeof file.text === 'string'
      ? file.text
      : file.error
        ? null
        : null;
  // Binary / missing → null (treat as new or unrestorable via text).
  if (file.binary) {
    inflight.set(resolved.rel, null);
    return;
  }
  if (file.error && /no such file|enoent|not found/i.test(String(file.error))) {
    inflight.set(resolved.rel, null);
    return;
  }
  inflight.set(resolved.rel, before);
}

export async function recordEditResult(opts: {
  cwd: string;
  path: string;
  /** Prefer SDK-provided unified diff when present. */
  diffString?: string;
  linesAdded?: number;
  linesRemoved?: number;
  /** After text when known (e.g. write args). */
  afterText?: string;
  extraRoots?: string[];
}): Promise<PendingEdit | null> {
  const extra = opts.extraRoots ?? [];
  const resolved = await resolveUnderCwd(opts.cwd, opts.path, extra);
  if ('error' in resolved) return null;
  const rel = resolved.rel;

  let before = inflight.get(rel);
  if (before === undefined) {
    // Missed the running event — try git-less empty before.
    before = null;
  }
  inflight.delete(rel);

  let after = opts.afterText;
  if (after == null) {
    const file = await readWorkspaceFile(opts.cwd, rel, extra);
    after = typeof file.text === 'string' ? file.text : '';
  }

  let diff = opts.diffString?.trim() || '';
  let linesAdded = opts.linesAdded;
  let linesRemoved = opts.linesRemoved;

  if (!diff) {
    const built = formatUnifiedDiff(rel, before ?? '', after);
    diff = built.diff;
    linesAdded = built.linesAdded;
    linesRemoved = built.linesRemoved;
  } else if (linesAdded == null || linesRemoved == null) {
    const counts = countDiffLines(diff);
    linesAdded = linesAdded ?? counts.added;
    linesRemoved = linesRemoved ?? counts.removed;
  }

  if (!diff.trim() && before === after) return null;

  const entry: PendingEdit = {
    path: rel,
    before: before ?? null,
    diff,
    linesAdded: linesAdded ?? 0,
    linesRemoved: linesRemoved ?? 0,
  };
  pending.set(rel, entry);
  return entry;
}

export async function keepPending(paths?: string[]): Promise<string[]> {
  const targets = selectPaths(paths);
  for (const path of targets) pending.delete(path);
  return targets;
}

export async function discardPending(
  cwd: string,
  paths?: string[],
  extraRoots: string[] = [],
): Promise<{ restored: string[]; errors: string[] }> {
  const targets = selectPaths(paths);
  const restored: string[] = [];
  const errors: string[] = [];

  for (const path of targets) {
    const entry = pending.get(path);
    if (!entry) continue;
    try {
      const resolved = await resolveUnderCwd(cwd, path, extraRoots);
      if ('error' in resolved) {
        errors.push(`${path}: ${resolved.error}`);
        continue;
      }
      if (entry.before == null) {
        await unlink(resolved.abs).catch(async (err: NodeJS.ErrnoException) => {
          if (err.code !== 'ENOENT') throw err;
        });
      } else {
        await mkdir(dirname(resolved.abs), { recursive: true });
        await writeFile(resolved.abs, entry.before, 'utf8');
      }
      pending.delete(path);
      restored.push(path);
    } catch (err) {
      errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { restored, errors };
}

export function clearPending() {
  pending.clear();
  inflight.clear();
}

function selectPaths(paths?: string[]): string[] {
  if (paths?.length) {
    return paths.map((p) => p.replace(/^\.\//, '')).filter((p) => pending.has(p));
  }
  return [...pending.keys()];
}

function countDiffLines(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) added += 1;
    else if (line.startsWith('-') && !line.startsWith('---')) removed += 1;
  }
  return { added, removed };
}
