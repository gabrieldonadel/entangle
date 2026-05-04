#!/usr/bin/env node
// Parses a release tag of the form `vMAJOR.MINOR.PATCH-{mobile,desktop}`.
// Accepts either a positional argument or $GITHUB_REF (refs/tags/<tag>).
// On match: prints `app=<app>` and `version=<x.y.z>` lines, also writes them
// to $GITHUB_OUTPUT when set (so GHA can `${{ steps.parse.outputs.version }}`).
// On miss: prints the offending value to stderr and exits 1.

import { appendFileSync } from 'node:fs';

const TAG_RE = /^v(\d+\.\d+\.\d+)-(mobile|desktop)$/;

function pickInput() {
  const arg = process.argv[2];
  if (arg && arg.length > 0) return arg;
  const ref = process.env.GITHUB_REF;
  if (ref) return ref.startsWith('refs/tags/') ? ref.slice('refs/tags/'.length) : ref;
  return '';
}

const input = pickInput();
const m = TAG_RE.exec(input);
if (!m) {
  console.error(
    `parse-release-tag: input "${input}" does not match v<x.y.z>-{mobile,desktop}`,
  );
  process.exit(1);
}

const [, version, app] = m;

console.log(`app=${app}`);
console.log(`version=${version}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `app=${app}\nversion=${version}\n`);
}
