import {registerRootComponent} from 'expo';
import {customBubblingEventTypes} from 'react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry';

import App from './App';

// Fabric on RN-macOS dispatches topKeyDown / topKeyUp from TextInput and View.
// Register them eagerly so typing in Preferences cannot hit an unregistered
// event type if Metro resolves the iOS BaseViewConfig (no macOS key events).
if (customBubblingEventTypes.topKeyDown == null) {
  customBubblingEventTypes.topKeyDown = {
    phasedRegistrationNames: {
      captured: 'onKeyDownCapture',
      bubbled: 'onKeyDown',
    },
  };
}
if (customBubblingEventTypes.topKeyUp == null) {
  customBubblingEventTypes.topKeyUp = {
    phasedRegistrationNames: {
      captured: 'onKeyUpCapture',
      bubbled: 'onKeyUp',
    },
  };
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
