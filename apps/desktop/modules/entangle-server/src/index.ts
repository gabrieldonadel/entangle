import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export type Preferences = {
  serverName: string;
  port: number;
  discoverable: boolean;
  sensitivity: number;
  naturalScroll: boolean;
  tapToClick: boolean;
  openAtLogin: boolean;
  showMenuBarIcon: boolean;
  hideDockIcon: boolean;
};

export type PairingWindow = {
  code: string;
  token: string;
  expiresAt: number;
};

type NativeModuleType = {
  startServer(): Promise<{ port: number; serviceName: string }>;
  stopServer(): Promise<void>;
  sendToClient(clientId: string, text: string): Promise<void>;
  broadcast(text: string): Promise<void>;
  isAccessibilityTrusted(): boolean;
  promptAccessibility(): Promise<boolean>;
  startPairing(): Promise<PairingWindow>;
  stopPairing(): Promise<void>;
  forgetAllPaired(): Promise<void>;
  isPairing(): boolean;
  getPreferences(): Preferences;
  setPreferences(patch: Partial<Preferences>): Promise<Preferences>;
  addListener(event: string): void;
  removeListeners(count: number): void;
};

const nativeModule = requireNativeModule<NativeModuleType>('EntangleServer');

export type ClientConnectedEvent = { id: string; host: string };
export type ClientDisconnectedEvent = { id: string };
export type ServerMessageEvent = { id: string; text: string; handledNatively: boolean };
export type ServerErrorEvent = { message: string };
export type ServerReadyEvent = { port: number; serviceName: string };
export type AccessibilityChangedEvent = { trusted: boolean };
export type PairingStartedEvent = PairingWindow;
export type PairRejectedEvent = { id: string; host: string };
export type PreferencesChangedEvent = Preferences;

export type EntangleServerEvents = {
  clientConnected: (event: ClientConnectedEvent) => void;
  clientDisconnected: (event: ClientDisconnectedEvent) => void;
  message: (event: ServerMessageEvent) => void;
  error: (event: ServerErrorEvent) => void;
  serverReady: (event: ServerReadyEvent) => void;
  accessibilityChanged: (event: AccessibilityChangedEvent) => void;
  pairingStarted: (event: PairingStartedEvent) => void;
  pairingStopped: () => void;
  pairingExpired: () => void;
  pairRejected: (event: PairRejectedEvent) => void;
  preferencesChanged: (event: PreferencesChangedEvent) => void;
};

export const eventEmitter = new EventEmitter<EntangleServerEvents>(nativeModule as any);

export function startServer() {
  return nativeModule.startServer();
}

export function stopServer() {
  return nativeModule.stopServer();
}

export function sendToClient(clientId: string, text: string) {
  return nativeModule.sendToClient(clientId, text);
}

export function broadcast(text: string) {
  return nativeModule.broadcast(text);
}

export function isAccessibilityTrusted() {
  return nativeModule.isAccessibilityTrusted();
}

export function promptAccessibility() {
  return nativeModule.promptAccessibility();
}

export function startPairing() {
  return nativeModule.startPairing();
}

export function stopPairing() {
  return nativeModule.stopPairing();
}

export function forgetAllPaired() {
  return nativeModule.forgetAllPaired();
}

export function isPairing() {
  return nativeModule.isPairing();
}

export function getPreferences() {
  return nativeModule.getPreferences();
}

export function setPreferences(patch: Partial<Preferences>) {
  return nativeModule.setPreferences(patch);
}

export default {
  startServer,
  stopServer,
  sendToClient,
  broadcast,
  isAccessibilityTrusted,
  promptAccessibility,
  startPairing,
  stopPairing,
  forgetAllPaired,
  isPairing,
  getPreferences,
  setPreferences,
  eventEmitter,
};
