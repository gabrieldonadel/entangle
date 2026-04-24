import { EventEmitter, requireNativeModule } from 'expo-modules-core';

type NativeModuleType = {
  startServer(): Promise<{ port: number; serviceName: string }>;
  stopServer(): Promise<void>;
  sendToClient(clientId: string, text: string): Promise<void>;
  broadcast(text: string): Promise<void>;
  addListener(event: string): void;
  removeListeners(count: number): void;
};

const nativeModule = requireNativeModule<NativeModuleType>('EntangleServer');

export type ClientConnectedEvent = { id: string; host: string };
export type ClientDisconnectedEvent = { id: string };
export type ServerMessageEvent = { id: string; text: string };
export type ServerErrorEvent = { message: string };
export type ServerReadyEvent = { port: number; serviceName: string };

export type EntangleServerEvents = {
  clientConnected: (event: ClientConnectedEvent) => void;
  clientDisconnected: (event: ClientDisconnectedEvent) => void;
  message: (event: ServerMessageEvent) => void;
  error: (event: ServerErrorEvent) => void;
  serverReady: (event: ServerReadyEvent) => void;
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

export default {
  startServer,
  stopServer,
  sendToClient,
  broadcast,
  eventEmitter,
};
