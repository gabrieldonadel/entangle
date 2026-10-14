module.exports = function (api) {
  api.cache(true);
  return {
    // react-native-macos 0.83 ships the legacy Hermes (hermes-engine 0.14), which
    // rejects private class fields. babel-preset-expo 58 defaults to the Hermes V1
    // profile and keeps them, so pin the v0 profile until RN-macOS moves to Hermes V1.
    presets: [['babel-preset-expo', { unstable_transformProfile: 'hermes-v0' }]],
  };
};
