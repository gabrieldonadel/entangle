#!/usr/bin/env node
// Runs on EAS Build via the `eas-build-pre-upload-artifacts` package.json hook,
// AFTER Gradle has produced the signed AAB but BEFORE EAS uploads artifacts.
// Uses bundletool to extract a universal, signed APK from the AAB and drops it
// into build-artifacts/ so `android.buildArtifactPaths` in eas.json picks it up.

import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_DIR = resolve(__dirname, '..');
const ANDROID_DIR = join(MOBILE_DIR, 'android');
const AAB_PATH = join(ANDROID_DIR, 'app/build/outputs/bundle/release/app-release.aab');
const OUT_DIR = join(MOBILE_DIR, 'build-artifacts');
const BUNDLETOOL_VERSION = '1.17.2';
const BUNDLETOOL_URL = `https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar`;

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

if (!existsSync(AAB_PATH)) {
  console.log(`[universal-apk] No AAB at ${AAB_PATH} — nothing to do (not a bundle build).`);
  process.exit(0);
}

// Resolve signing credentials. EAS Build injects them differently depending on
// the flow; check env vars first, then fall back to gradle.properties keys we
// know about. Bail out (without failing the build) if nothing matches — the
// AAB still uploads normally.
const propsPath = join(ANDROID_DIR, 'gradle.properties');
const props = existsSync(propsPath) ? readFileSync(propsPath, 'utf8') : '';
const getProp = (key) => {
  const m = props.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : undefined;
};
const firstDefined = (...vals) => vals.find((v) => v !== undefined && v !== '');

const ksPath = firstDefined(
  process.env.EAS_BUILD_ANDROID_KEYSTORE_PATH,
  process.env.ANDROID_KEYSTORE_PATH,
  getProp('EXPO_RELEASE_STORE_FILE'),
  getProp('MYAPP_UPLOAD_STORE_FILE'),
  getProp('MYAPP_RELEASE_STORE_FILE'),
);
const ksPassword = firstDefined(
  process.env.EAS_BUILD_ANDROID_KEYSTORE_PASSWORD,
  process.env.ANDROID_KEYSTORE_PASSWORD,
  getProp('EXPO_RELEASE_STORE_PASSWORD'),
  getProp('MYAPP_UPLOAD_STORE_PASSWORD'),
  getProp('MYAPP_RELEASE_STORE_PASSWORD'),
);
const keyAlias = firstDefined(
  process.env.EAS_BUILD_ANDROID_KEY_ALIAS,
  process.env.ANDROID_KEY_ALIAS,
  getProp('EXPO_RELEASE_KEY_ALIAS'),
  getProp('MYAPP_UPLOAD_KEY_ALIAS'),
  getProp('MYAPP_RELEASE_KEY_ALIAS'),
);
const keyPassword = firstDefined(
  process.env.EAS_BUILD_ANDROID_KEY_PASSWORD,
  process.env.ANDROID_KEY_PASSWORD,
  getProp('EXPO_RELEASE_KEY_PASSWORD'),
  getProp('MYAPP_UPLOAD_KEY_PASSWORD'),
  getProp('MYAPP_RELEASE_KEY_PASSWORD'),
);

if (!ksPath || !ksPassword || !keyAlias || !keyPassword) {
  console.warn('[universal-apk] Could not resolve Android signing credentials — skipping.');
  console.warn('  Set EAS_BUILD_ANDROID_KEYSTORE_PATH / _PASSWORD / _KEY_ALIAS / _KEY_PASSWORD');
  console.warn('  or expose them via gradle.properties (EXPO_RELEASE_* or MYAPP_UPLOAD_*).');
  // Diagnostic dump (keys only, never values) so we can see what EAS actually
  // exposes on this build. Remove once the right names are confirmed.
  const credEnvKeys = Object.keys(process.env)
    .filter((k) => /KEYSTORE|KEY_ALIAS|KEY_PASSWORD|SIGNING|ANDROID_KEY/i.test(k))
    .sort();
  console.warn(`  env vars matching credential patterns: ${JSON.stringify(credEnvKeys)}`);
  const easEnvKeys = Object.keys(process.env)
    .filter((k) => k.startsWith('EAS_BUILD_') || k.startsWith('EAS_'))
    .sort();
  console.warn(`  EAS_* env vars present: ${JSON.stringify(easEnvKeys)}`);
  const propKeys = [...props.matchAll(/^\s*([A-Za-z0-9_.]+)\s*=/gm)].map((m) => m[1]).sort();
  console.warn(`  gradle.properties keys: ${JSON.stringify(propKeys)}`);
  process.exit(0);
}

const resolvedKsPath = resolve(ANDROID_DIR, ksPath);
if (!existsSync(resolvedKsPath)) {
  console.warn(`[universal-apk] Keystore not found at ${resolvedKsPath} — skipping.`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });

const bundletoolJar = join(tmpdir(), `bundletool-${BUNDLETOOL_VERSION}.jar`);
if (!existsSync(bundletoolJar)) {
  run(`curl -fsSL --retry 3 -o "${bundletoolJar}" "${BUNDLETOOL_URL}"`);
}

const apksZip = join(tmpdir(), 'universal.apks');
rmSync(apksZip, { force: true });
run(
  [
    'java -jar',
    `"${bundletoolJar}"`,
    'build-apks',
    `--bundle="${AAB_PATH}"`,
    `--output="${apksZip}"`,
    '--mode=universal',
    `--ks="${resolvedKsPath}"`,
    `--ks-pass=pass:${ksPassword}`,
    `--ks-key-alias=${keyAlias}`,
    `--key-pass=pass:${keyPassword}`,
    '--overwrite',
  ].join(' '),
);

const extractDir = join(tmpdir(), 'universal-apks-extract');
rmSync(extractDir, { recursive: true, force: true });
mkdirSync(extractDir, { recursive: true });
run(`unzip -o "${apksZip}" -d "${extractDir}"`);

const finalApk = join(OUT_DIR, 'entangle-mobile-universal.apk');
copyFileSync(join(extractDir, 'universal.apk'), finalApk);
console.log(`[universal-apk] Wrote ${finalApk}`);
