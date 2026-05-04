#!/usr/bin/env node
// Writes a version into the right files for an app.
// Usage: bump-version.mjs <mobile|desktop> <x.y.z> [--dry-run]
//
// Mobile  → apps/mobile/package.json (version), apps/mobile/app.json (expo.version)
// Desktop → apps/desktop/package.json (version),
//           apps/desktop/macos/entangle-macOS/Info.plist (CFBundleShortVersionString)
//
// Build numbers (ios.buildNumber / android.versionCode / CFBundleVersion) are
// intentionally not touched here — EAS handles that for mobile via
// production.autoIncrement, and the desktop publish workflow stamps
// CFBundleVersion from GITHUB_RUN_NUMBER at build time.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const [, , app, version, ...rest] = process.argv;
const dryRun = rest.includes('--dry-run');

if (!app || !version) {
  console.error('usage: bump-version.mjs <mobile|desktop> <x.y.z> [--dry-run]');
  process.exit(2);
}
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`bump-version: "${version}" is not a valid x.y.z version`);
  process.exit(2);
}

const edits = app === 'mobile' ? mobileEdits(version) : app === 'desktop' ? desktopEdits(version) : null;
if (!edits) {
  console.error(`bump-version: unknown app "${app}" (expected mobile or desktop)`);
  process.exit(2);
}

for (const edit of edits) edit(dryRun);

function mobileEdits(v) {
  return [
    setJsonKey(resolve(REPO_ROOT, 'apps/mobile/package.json'), ['version'], v),
    setJsonKey(resolve(REPO_ROOT, 'apps/mobile/app.json'), ['expo', 'version'], v),
  ];
}

function desktopEdits(v) {
  return [
    setJsonKey(resolve(REPO_ROOT, 'apps/desktop/package.json'), ['version'], v),
    setPlistString(
      resolve(REPO_ROOT, 'apps/desktop/macos/entangle-macOS/Info.plist'),
      'CFBundleShortVersionString',
      v,
    ),
  ];
}

function setJsonKey(file, path, value) {
  return (dryRun) => {
    const before = readFileSync(file, 'utf8');
    const data = JSON.parse(before);
    let cursor = data;
    for (let i = 0; i < path.length - 1; i++) {
      cursor[path[i]] ??= {};
      cursor = cursor[path[i]];
    }
    cursor[path[path.length - 1]] = value;
    const after = JSON.stringify(data, null, 2) + (before.endsWith('\n') ? '\n' : '');
    report(file, before, after, dryRun);
  };
}

function setPlistString(file, key, value) {
  return (dryRun) => {
    const before = readFileSync(file, 'utf8');
    // Match `<key>NAME</key>` followed (allowing whitespace/newlines) by `<string>...</string>`.
    const re = new RegExp(
      `(<key>${escapeRe(key)}</key>\\s*<string>)([^<]*)(</string>)`,
    );
    if (!re.test(before)) {
      throw new Error(`setPlistString: <key>${key}</key>/<string> pair not found in ${file}`);
    }
    const after = before.replace(re, `$1${value}$3`);
    report(file, before, after, dryRun);
  };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function report(file, before, after, dryRun) {
  const rel = file.startsWith(REPO_ROOT + '/') ? file.slice(REPO_ROOT.length + 1) : file;
  if (before === after) {
    console.log(`= ${rel} (no change)`);
    return;
  }
  if (dryRun) {
    console.log(`~ ${rel} (would update)`);
    return;
  }
  writeFileSync(file, after);
  console.log(`✓ ${rel}`);
}
