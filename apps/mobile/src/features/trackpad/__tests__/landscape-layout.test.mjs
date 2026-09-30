import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const appConfigUrl = new URL('../../../../app.json', import.meta.url);
const layoutUrl = new URL('../layout.ts', import.meta.url);
const require = createRequire(import.meta.url);
const ts = require('typescript');

let getTrackpadLayout;
try {
  const source = await readFile(layoutUrl, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { module: { exports: {} } };
  context.exports = context.module.exports;
  vm.runInNewContext(compiled, context);
  ({ getTrackpadLayout } = context.module.exports);
} catch {
  // The first red run happens before the layout module exists.
}

test('the mobile app allows iOS to rotate into landscape', async () => {
  const appConfig = JSON.parse(await readFile(appConfigUrl, 'utf8'));

  assert.equal(appConfig.expo.orientation, 'default');
});

test('trackpad layout becomes compact in landscape and stays roomy in portrait', () => {
  assert.equal(typeof getTrackpadLayout, 'function');

  assert.deepEqual({ ...getTrackpadLayout(844, 390) }, {
    isLandscape: true,
    rootPaddingVertical: 8,
    headerPaddingVertical: 2,
    serverNameFontSize: 18,
  });
  assert.deepEqual({ ...getTrackpadLayout(390, 844) }, {
    isLandscape: false,
    rootPaddingVertical: 16,
    headerPaddingVertical: 8,
    serverNameFontSize: 22,
  });
});
