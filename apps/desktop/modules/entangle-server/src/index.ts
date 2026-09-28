import { EventEmitter, requireNativeModule } from 'expo-modules-core';

export type Preferences = {
  serverName: string;
  port: number;
  discoverable: boolean;
  sensitivity: number;
  naturalScroll: boolean;
  tapToClick: boolean;
  highlightPointer: boolean;
  openAtLogin: boolean;
  showMenuBarIcon: boolean;
  hideDockIcon: boolean;
  cursorAllowPhones: boolean;
  cursorWorkspacePath: string;
  /** Folders phones may switch between; active is `cursorWorkspacePath`. */
  cursorWorkspaceAllowlist: string[];
  cursorModel: string;
  cursorModelParams?: string;
  cursorHasApiKey: boolean;
  cursorReady: boolean;
  clipboardSync: boolean;
};

export type PairingWindow = {
  code: string;
  token: string;
  expiresAt: number;
};

export type CursorStatusPayload = {
  type?: string;
  status: string;
  agentId?: string;
  runId?: string;
  cwd?: string;
  model?: string;
  error?: string;
  usage?: Record<string, number | undefined>;
};

export type CursorDeltaPayload = {
  type?: string;
  kind: 'assistant' | 'thinking' | 'tool' | 'result' | string;
  text: string;
  agentId: string;
  runId: string;
};

export type CursorSnapshotPayload = CursorStatusPayload & {
  type?: string;
  transcript?: { role: string; text: string }[];
};

export type CursorErrorPayload = {
  type?: string;
  message: string;
};

export type CursorFilesPayload = {
  type?: string;
  files?: { path?: string; op?: string }[];
  agentId?: string;
  runId?: string;
};

export type CursorDiffsPayload = {
  type?: string;
  files?: {
    path?: string;
    diff?: string;
    linesAdded?: number;
    linesRemoved?: number;
  }[];
  agentId?: string;
  runId?: string;
  kept?: string[];
  discarded?: string[];
  error?: string;
};

type NativeModuleType = {
  startServer(): Promise<{ port: number; serviceName: string; lanHost?: string }>;
  stopServer(): Promise<void>;
  sendToClient(clientId: string, text: string): Promise<void>;
  broadcast(text: string): Promise<void>;
  isAccessibilityTrusted(): boolean;
  promptAccessibility(): Promise<boolean>;
  getLanHost(): string | null;
  startPairing(): Promise<PairingWindow>;
  stopPairing(): Promise<void>;
  forgetAllPaired(): Promise<void>;
  disconnectClient(id: string): Promise<void>;
  forgetClient(id: string): Promise<void>;
  getClientNames(): Record<string, string>;
  setClientName(host: string, name: string | null): Promise<void>;
  isPairing(): boolean;
  getPreferences(): Preferences;
  setPreferences(patch: Partial<Preferences>): Promise<Preferences>;
  cursorIsReady(): boolean;
  hasCursorApiKey(): boolean;
  setCursorApiKey(key: string): Promise<Preferences>;
  setCursorApiKeyFromClipboard(): Promise<Preferences>;
  cursorReadinessDetail(): string;
  /** Base64 PNG for an installed app; empty string if not found. */
  appIconPng(bundleId: string, name: string): string;
  listCursorModels(): Promise<Record<string, unknown>[]>;
  clearCursorApiKey(): Promise<Preferences>;
  pickCursorWorkspace(): Promise<Preferences>;
  removeCursorWorkspace(path: string): Promise<Preferences>;
  setActiveCursorWorkspace(path: string): Promise<Preferences>;
  cursorWorkspaces(): {
    workspaces: { path: string; name: string; kind?: 'folder' | 'code-workspace' }[];
    active?: string;
  };
  cursorEnsureHost(): Promise<void>;
  cursorSetModel(modelId: string, paramsJson: string | null): Promise<Preferences>;
  cursorUsage(agentId: string | null): Promise<Record<string, unknown>>;
  cursorMe(): Promise<Record<string, unknown>>;
  cursorListAgents(
    cursor: string | null,
    limit: number | null,
  ): Promise<Record<string, unknown>>;
  cursorOpenAgent(agentId: string): Promise<void>;
  cursorNewChat(): Promise<void>;
  cursorPrompt(text: string, agentId: string | null, imagesJson: string | null): Promise<void>;
  cursorCancel(): Promise<void>;
  cursorResume(): Promise<void>;
  cursorGetSnapshot(): Promise<CursorSnapshotPayload>;
  cursorReadFile(path: string): Promise<Record<string, unknown>>;
  cursorListDir(path: string | null): Promise<Record<string, unknown>>;
  cursorKeepFiles(pathsJson: string | null): Promise<void>;
  cursorDiscardFiles(pathsJson: string | null): Promise<void>;
  cursorListDiffs(): Promise<void>;
  addListener(event: string): void;
  removeListeners(count: number): void;
};

const nativeModule = requireNativeModule<NativeModuleType>('EntangleServer');

export type ClientConnectedEvent = {
  id: string;
  host: string;
  /** Present when the datagram listener is up; goes into `welcome`. */
  udpPort?: number;
  udpToken?: string;
};
export type ClientDisconnectedEvent = { id: string };
export type ServerMessageEvent = { id: string; text: string; handledNatively: boolean };
/**
 * Inbound message counts for the last second, one entry per client. Pointer
 * moves are handled natively and never reach the `message` event, so this is
 * the only place the UI sees them.
 */
export type MessageStatsEvent = {
  clients: { id: string; count: number }[];
  total: number;
};
export type ServerErrorEvent = { message: string };
export type ServerReadyEvent = { port: number; serviceName: string; lanHost?: string };
export type AccessibilityChangedEvent = { trusted: boolean };
export type PairingStartedEvent = PairingWindow;
export type PairRejectedEvent = { id: string; host: string };
export type PreferencesChangedEvent = Preferences;

export type EntangleServerEvents = {
  clientConnected: (event: ClientConnectedEvent) => void;
  clientDisconnected: (event: ClientDisconnectedEvent) => void;
  message: (event: ServerMessageEvent) => void;
  messageStats: (event: MessageStatsEvent) => void;
  error: (event: ServerErrorEvent) => void;
  serverReady: (event: ServerReadyEvent) => void;
  accessibilityChanged: (event: AccessibilityChangedEvent) => void;
  pairingStarted: (event: PairingStartedEvent) => void;
  pairingStopped: () => void;
  pairingExpired: () => void;
  pairRejected: (event: PairRejectedEvent) => void;
  preferencesChanged: (event: PreferencesChangedEvent) => void;
  cursorStatus: (event: CursorStatusPayload) => void;
  cursorDelta: (event: CursorDeltaPayload) => void;
  cursorSnapshot: (event: CursorSnapshotPayload) => void;
  cursorError: (event: CursorErrorPayload) => void;
  cursorFiles: (event: CursorFilesPayload) => void;
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

export function getLanHost(): string | null {
  return nativeModule.getLanHost();
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

export function disconnectClient(id: string) {
  return nativeModule.disconnectClient(id);
}

export function forgetClient(id: string) {
  return nativeModule.forgetClient(id);
}

export function getClientNames(): Record<string, string> {
  return nativeModule.getClientNames();
}

export function setClientName(host: string, name: string | null) {
  return nativeModule.setClientName(host, name);
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

export function cursorIsReady() {
  return nativeModule.cursorIsReady();
}

export function hasCursorApiKey() {
  return nativeModule.hasCursorApiKey();
}

export function setCursorApiKey(key: string) {
  return nativeModule.setCursorApiKey(key);
}

export function setCursorApiKeyFromClipboard() {
  return nativeModule.setCursorApiKeyFromClipboard();
}

export function cursorReadinessDetail() {
  return nativeModule.cursorReadinessDetail();
}

/** Dock-style base64 PNG for an app on disk. Empty if Launch Services cannot resolve it. */
export function appIconPng(bundleId: string, name: string) {
  return nativeModule.appIconPng(bundleId, name);
}

export function listCursorModels() {
  return nativeModule.listCursorModels();
}

export function clearCursorApiKey() {
  return nativeModule.clearCursorApiKey();
}

export function pickCursorWorkspace() {
  return nativeModule.pickCursorWorkspace();
}

export function removeCursorWorkspace(path: string) {
  return nativeModule.removeCursorWorkspace(path);
}

export function setActiveCursorWorkspace(path: string) {
  return nativeModule.setActiveCursorWorkspace(path);
}

export function cursorWorkspaces() {
  return nativeModule.cursorWorkspaces();
}

export function cursorEnsureHost() {
  return nativeModule.cursorEnsureHost();
}

export function cursorSetModel(modelId: string, paramsJson: string | null = null) {
  return nativeModule.cursorSetModel(modelId, paramsJson);
}

export function cursorUsage(agentId: string | null = null) {
  return nativeModule.cursorUsage(agentId);
}

export function cursorMe() {
  return nativeModule.cursorMe();
}

export function cursorListAgents(cursor: string | null = null, limit: number | null = null) {
  return nativeModule.cursorListAgents(cursor, limit);
}

export function cursorOpenAgent(agentId: string) {
  return nativeModule.cursorOpenAgent(agentId);
}

export function cursorNewChat() {
  return nativeModule.cursorNewChat();
}

export function cursorPrompt(
  text: string,
  agentId: string | null = null,
  imagesJson: string | null = null,
) {
  return nativeModule.cursorPrompt(text, agentId, imagesJson);
}

export function cursorCancel() {
  return nativeModule.cursorCancel();
}

export function cursorResume() {
  return nativeModule.cursorResume();
}

export function cursorGetSnapshot() {
  return nativeModule.cursorGetSnapshot();
}

export function cursorReadFile(path: string) {
  return nativeModule.cursorReadFile(path);
}

export function cursorListDir(path: string | null = null) {
  return nativeModule.cursorListDir(path);
}

export function cursorKeepFiles(paths: string[] | null = null) {
  return nativeModule.cursorKeepFiles(paths?.length ? JSON.stringify(paths) : null);
}

export function cursorDiscardFiles(paths: string[] | null = null) {
  return nativeModule.cursorDiscardFiles(paths?.length ? JSON.stringify(paths) : null);
}

export function cursorListDiffs() {
  return nativeModule.cursorListDiffs();
}

export default {
  startServer,
  stopServer,
  sendToClient,
  broadcast,
  isAccessibilityTrusted,
  promptAccessibility,
  getLanHost,
  startPairing,
  stopPairing,
  forgetAllPaired,
  disconnectClient,
  forgetClient,
  getClientNames,
  setClientName,
  isPairing,
  getPreferences,
  setPreferences,
  cursorIsReady,
  hasCursorApiKey,
  setCursorApiKey,
  setCursorApiKeyFromClipboard,
  cursorReadinessDetail,
  appIconPng,
  listCursorModels,
  clearCursorApiKey,
  pickCursorWorkspace,
  removeCursorWorkspace,
  setActiveCursorWorkspace,
  cursorWorkspaces,
  cursorEnsureHost,
  cursorSetModel,
  cursorUsage,
  cursorMe,
  cursorListAgents,
  cursorOpenAgent,
  cursorNewChat,
  cursorPrompt,
  cursorCancel,
  cursorResume,
  cursorGetSnapshot,
  cursorReadFile,
  cursorListDir,
  cursorKeepFiles,
  cursorDiscardFiles,
  cursorListDiffs,
  eventEmitter,
};
