// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // React Compiler rules new in eslint-plugin-react-hooks 7 (SDK 58). They
    // flag components the compiler already skips; the gesture code reads refs
    // during render on purpose. Warn so the skips stay visible.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
