/**
 * The macOS resolver rule: react-native-macos's own relative imports must see
 * its `.macos.js` files first; every other request keeps iOS first, because
 * the rest of the tree only ships `.ios.js`.
 */
jest.mock('expo/metro-config', () => ({
  getDefaultConfig: () => ({ resolver: {}, serializer: {} }),
}));

const config = require('../../metro.config.js');

type Attempt = { moduleName: string; platform: string | null };

function resolveWith(originModulePath: string, moduleName: string, failOn: string[] = []) {
  const attempts: Attempt[] = [];
  const context = {
    originModulePath,
    resolveRequest: (_ctx: unknown, name: string, platform: string | null) => {
      attempts.push({ moduleName: name, platform });
      if (failOn.includes(String(platform))) throw new Error(`no ${platform} file`);
      return { type: 'sourceFile', filePath: `${name}.${platform}.js` };
    },
  };
  const result = config.resolver.resolveRequest(context, moduleName, 'macos');
  return { attempts, result };
}

const RN_MACOS = '/repo/node_modules/react-native-macos/Libraries/NativeComponent/PlatformBaseViewConfig.js';
const APP = '/repo/apps/desktop/src/App.tsx';

test('relative imports inside react-native-macos resolve for macos first', () => {
  const { attempts } = resolveWith(RN_MACOS, './BaseViewConfig');
  expect(attempts).toEqual([{ moduleName: './BaseViewConfig', platform: 'macos' }]);
});

test('relative imports inside react-native-macos fall back to ios', () => {
  const { attempts } = resolveWith(RN_MACOS, './RCTAlertManager', ['macos']);
  expect(attempts.map((a) => a.platform)).toEqual(['macos', 'ios']);
});

test('bare imports resolve for ios first, even from react-native-macos', () => {
  expect(resolveWith(RN_MACOS, 'invariant').attempts.map((a) => a.platform)).toEqual(['ios']);
  expect(resolveWith(APP, 'expo-linear-gradient').attempts.map((a) => a.platform)).toEqual(['ios']);
});

test('react-native is rewritten to react-native-macos on the macos platform', () => {
  const { attempts } = resolveWith(APP, 'react-native/Libraries/Core/InitializeCore');
  expect(attempts).toEqual([
    { moduleName: 'react-native-macos/Libraries/Core/InitializeCore', platform: 'macos' },
  ]);
});
