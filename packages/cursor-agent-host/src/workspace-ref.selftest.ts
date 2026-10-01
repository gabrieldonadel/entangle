/**
 * Quick self-check for workspace-ref (run: node --experimental-strip-types
 * or after build: node dist/workspace-ref.selftest.js — invoked from package script).
 */
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCodeWorkspaceFile, resolveWorkspaceRef } from './workspace-ref.js';

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'entangle-ws-'));
  const a = await realpath(await mkdir(join(root, 'alpha'), { recursive: true }).then(() => join(root, 'alpha')));
  const b = await realpath(await mkdir(join(root, 'beta'), { recursive: true }).then(() => join(root, 'beta')));
  const wsFile = join(root, 'Partners.code-workspace');
  await writeFile(
    wsFile,
    JSON.stringify({
      folders: [{ path: 'alpha' }, { path: 'beta', name: 'Beta' }],
    }),
    'utf8',
  );

  const parsed = await parseCodeWorkspaceFile(wsFile);
  if (parsed.cwd !== a) throw new Error(`expected cwd ${a}, got ${parsed.cwd}`);
  if (parsed.dirs.length !== 1 || parsed.dirs[0] !== b) {
    throw new Error(`expected dirs [${b}], got ${JSON.stringify(parsed.dirs)}`);
  }
  if (parsed.name !== 'Partners') throw new Error(`expected name Partners, got ${parsed.name}`);

  const folder = await resolveWorkspaceRef(a);
  if (folder.kind !== 'folder' || folder.cwd !== a || folder.dirs.length) {
    throw new Error(`folder resolve failed: ${JSON.stringify(folder)}`);
  }

  const multi = await resolveWorkspaceRef(wsFile);
  if (multi.kind !== 'code-workspace' || multi.name !== 'Partners') {
    throw new Error(`code-workspace resolve failed: ${JSON.stringify(multi)}`);
  }
  if (multi.cwd !== a || multi.dirs[0] !== b) {
    throw new Error(`multi roots mismatch: ${JSON.stringify(multi)}`);
  }

  console.log('workspace-ref ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
