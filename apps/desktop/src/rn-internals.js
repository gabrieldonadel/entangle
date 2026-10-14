// RN 0.88's `react-native/unstable-internals-do-not-use`, rebuilt from RN-macOS
// 0.83's deep imports. ponytail: only the getters Expo 58 reads; add one when a
// bundle fails on a missing name. Delete this file once RN-macOS ships 0.88.
module.exports = {
  get AssetSourceResolver() {
    return require('react-native/Libraries/Image/AssetSourceResolver').default;
  },
  get DevLoadingView() {
    return require('react-native/Libraries/Utilities/DevLoadingView').default;
  },
  get HMRClient() {
    return require('react-native/Libraries/Utilities/HMRClient').default;
  },
  get NativeExceptionsManager() {
    return require('react-native/Libraries/Core/NativeExceptionsManager').default;
  },
  get NativeRedBox() {
    return require('react-native/Libraries/NativeModules/specs/NativeRedBox').default;
  },
  get NativeSourceCode() {
    return require('react-native/Libraries/NativeModules/specs/NativeSourceCode').default;
  },
};
