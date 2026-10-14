// The Podfile runs autolinking with `--platform ios`, and Expo 58 only skips
// the RN-macOS host under `--platform macos`. Without this it links
// react-native-macos through React-Core-prebuilt.podspec, which has no source
// when React Native builds from source, and `pod install` fails.
module.exports = {
  dependencies: {
    'react-native-macos': { platforms: { ios: null } },
  },
};
