// Learn more https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.watchFolders = [workspaceRoot];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'macos') {
    if (
      moduleName === 'react-native' ||
      moduleName.startsWith('react-native/')
    ) {
      const newModuleName = moduleName.replace(
        'react-native',
        'react-native-macos',
      );
      return context.resolveRequest(context, newModuleName, platform);
    }
    // react-native-macos reaches its `.macos.js` files (BaseViewConfig,
    // Platform, …) through relative imports, and those must win: the iOS
    // BaseViewConfig has no key events, so the first keystroke in a TextInput
    // throws on an unregistered topKeyDown. Every other package only ships
    // `.ios.js`, so iOS stays the platform for it.
    const macosFirst =
      moduleName.startsWith('.') &&
      context.originModulePath.includes('/react-native-macos/');
    try {
      return context.resolveRequest(context, moduleName, macosFirst ? platform : 'ios');
    } catch {}
    return context.resolveRequest(context, moduleName, macosFirst ? 'ios' : platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

const originalGetModulesRunBeforeMainModule =
  config.serializer.getModulesRunBeforeMainModule;
config.serializer.getModulesRunBeforeMainModule = () => {
  try {
    return [
      require.resolve('react-native/Libraries/Core/InitializeCore'),
      require.resolve('react-native-macos/Libraries/Core/InitializeCore'),
    ];
  } catch {}
  return originalGetModulesRunBeforeMainModule();
};

module.exports = config;
