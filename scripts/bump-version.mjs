#!/usr/bin/env node
// Writes a version into the right files for an app.
// Usage: bump-version.mjs <mobile|desktop> <x.y.z> [--dry-run]
//
// Mobile  → apps/mobile/package.json (version), apps/mobile/app.json (expo.version)
// Desktop → apps/desktop/package.json (version),
//           apps/desktop/macos/entangle-macOS/Info.plist (CFBundleShortVersionString,
//           CFBundleVersion += 1),
//           apps/desktop/macos/entangle-macOS/Supporting/Expo.plist
//           (EXUpdatesRuntimeVersion),
//           apps/website/src/constants.ts (DESKTOP_VERSION — both the nav
//           pill and DESKTOP_DMG_URL derive from this)
//
// iOS/Android build numbers are not touched here — EAS handles those via
// production.autoIncrement in apps/mobile/eas.json.

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
  const infoPlist = resolve(REPO_ROOT, 'apps/desktop/macos/entangle-macOS/Info.plist');
  const expoPlist = resolve(
    REPO_ROOT,
    'apps/desktop/macos/entangle-macOS/Supporting/Expo.plist',
  );
  const websiteConstants = resolve(REPO_ROOT, 'apps/website/src/constants.ts');
  return [
    setJsonKey(resolve(REPO_ROOT, 'apps/desktop/package.json'), ['version'], v),
    setPlistString(infoPlist, 'CFBundleShortVersionString', v),
    incrementPlistInt(infoPlist, 'CFBundleVersion'),
    setPlistString(expoPlist, 'EXUpdatesRuntimeVersion', v),
    setDesktopVersion(websiteConstants, v),
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

function incrementPlistInt(file, key) {
  return (dryRun) => {
    const before = readFileSync(file, 'utf8');
    const re = new RegExp(
      `(<key>${escapeRe(key)}</key>\\s*<string>)([^<]*)(</string>)`,
    );
    const m = re.exec(before);
    if (!m) {
      throw new Error(`incrementPlistInt: <key>${key}</key>/<string> pair not found in ${file}`);
    }
    const current = parseInt(m[2], 10);
    if (!Number.isFinite(current)) {
      throw new Error(`incrementPlistInt: ${key} value "${m[2]}" is not an integer`);
    }
    const next = String(current + 1);
    const after = before.replace(re, `$1${next}$3`);
    const rel = file.startsWith(REPO_ROOT + '/') ? file.slice(REPO_ROOT.length + 1) : file;
    console.log(`${dryRun ? '~' : '✓'} ${rel} (${key}: ${current} → ${next})`);
    if (!dryRun) writeFileSync(file, after);
  };
}

function setDesktopVersion(file, v) {
  return (dryRun) => {
    const before = readFileSync(file, 'utf8');
    const re = /(export const DESKTOP_VERSION = ")[^"]+(";)/;
    if (!re.test(before)) {
      throw new Error(`setDesktopVersion: DESKTOP_VERSION declaration not found in ${file}`);
    }
    const after = before.replace(re, `$1${v}$2`);
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
