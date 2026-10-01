/**
 * Resolve an allowlist entry (folder or `.code-workspace` file) into SDK
 * `local.cwd` + `local.dirs`.
 */

import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';

export type ResolvedWorkspace = {
  /** Allowlist entry the user picked (folder or .code-workspace). */
  workspacePath: string;
  /** Primary SDK cwd (first folder). */
  cwd: string;
  /** Extra multi-root folders (SDK `local.dirs`). */
  dirs: string[];
  /** Short label for UI (e.g. `Partners` or folder basename). */
  name: string;
  kind: 'folder' | 'code-workspace';
};

type CodeWorkspaceFolder = {
  path?: unknown;
  name?: unknown;
};

type CodeWorkspaceFile = {
  folders?: unknown;
};

function displayNameForPath(path: string, kind: 'folder' | 'code-workspace'): string {
  const base = basename(path);
  if (kind === 'code-workspace' && base.toLowerCase().endsWith('.code-workspace')) {
    return base.slice(0, -'.code-workspace'.length) || base;
  }
  return base || path;
}

function isCodeWorkspacePath(path: string): boolean {
  return basename(path).toLowerCase().endsWith('.code-workspace');
}

async function resolveExistingDir(path: string): Promise<string> {
  const abs = resolve(path);
  const st = await stat(abs);
  if (!st.isDirectory()) {
    throw new Error(`Not a directory: ${abs}`);
  }
  return realpath(abs).catch(() => abs);
}

/**
 * Parse a VS Code / Cursor `.code-workspace` file into absolute folder roots.
 * Relative `folders[].path` entries are resolved against the file's directory.
 */
export async function parseCodeWorkspaceFile(
  filePath: string,
): Promise<{ cwd: string; dirs: string[]; name: string }> {
  const absFile = resolve(filePath);
  const st = await stat(absFile);
  if (!st.isFile()) {
    throw new Error(`Not a workspace file: ${absFile}`);
  }
  const raw = await readFile(absFile, 'utf8');
  let parsed: CodeWorkspaceFile;
  try {
    parsed = JSON.parse(raw) as CodeWorkspaceFile;
  } catch {
    throw new Error(`Invalid .code-workspace JSON: ${absFile}`);
  }
  if (!Array.isArray(parsed.folders) || parsed.folders.length === 0) {
    throw new Error(`Workspace has no folders: ${absFile}`);
  }

  const baseDir = dirname(absFile);
  const roots: string[] = [];
  for (const entry of parsed.folders) {
    if (!entry || typeof entry !== 'object') continue;
    const folder = entry as CodeWorkspaceFolder;
    const rel = typeof folder.path === 'string' ? folder.path.trim() : '';
    if (!rel) continue;
    const candidate = isAbsolute(rel) ? resolve(rel) : resolve(baseDir, rel);
    try {
      roots.push(await resolveExistingDir(candidate));
    } catch {
      // Skip missing roots so a partially moved workspace still opens.
    }
  }
  if (!roots.length) {
    throw new Error(`Workspace folders not found on disk: ${absFile}`);
  }
  return {
    cwd: roots[0],
    dirs: roots.slice(1),
    name: displayNameForPath(absFile, 'code-workspace'),
  };
}

/** Resolve a folder path or `.code-workspace` file for the agent host. */
export async function resolveWorkspaceRef(inputPath: string): Promise<ResolvedWorkspace> {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error('Workspace path is empty');
  }
  const abs = resolve(trimmed);
  if (isCodeWorkspacePath(abs)) {
    const parsed = await parseCodeWorkspaceFile(abs);
    return {
      workspacePath: abs,
      cwd: parsed.cwd,
      dirs: parsed.dirs,
      name: parsed.name,
      kind: 'code-workspace',
    };
  }
  const cwd = await resolveExistingDir(abs);
  return {
    workspacePath: cwd,
    cwd,
    dirs: [],
    name: displayNameForPath(cwd, 'folder'),
    kind: 'folder',
  };
}
