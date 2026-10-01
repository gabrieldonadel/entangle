// Learn more https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.watchFolders = [workspaceRoot];

// RN-macOS ships BaseViewConfig.macos.js / Platform.macos.js; without this,
// Metro never considers the `.macos` platform extension and Fabric never
// registers topKeyDown / topKeyUp (crash when typing in TextInput).
config.resolver.platforms = Array.from(
  new Set([...(config.resolver.platforms ?? ['ios', 'android']), 'macos']),
);

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
    // Prefer `.macos.js`, then fall back to `.ios.js` for packages that only
    // ship iOS platform files (common for Expo modules).
    try {
      return context.resolveRequest(context, moduleName, platform);
    } catch {
      try {
        return context.resolveRequest(context, moduleName, 'ios');
      } catch {}
    }
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
