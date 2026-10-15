import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeEntangleUdp = {
  open(host: string, port: number): boolean;
  send(text: string): boolean;
  close(): void;
};

/**
 * Optional on purpose. The web build and any client without this native
 * module simply keep sending pointer frames over the WebSocket.
 */
const native = requireOptionalNativeModule<NativeEntangleUdp>('EntangleUdp');

export const isAvailable = native != null;

export function open(host: string, port: number): boolean {
  return native?.open(host, port) ?? false;
}

export function send(text: string): boolean {
  return native?.send(text) ?? false;
}

export function close(): void {
  native?.close();
}
