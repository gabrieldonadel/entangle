import { installOnUIRuntime, requireOptionalNativeModule } from 'expo-modules-core';

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

/**
 * Makes this module callable from Reanimated's UI runtime.
 *
 * Without it a worklet has no way to reach native code, and the pointer path
 * has to hop to the JS thread to put a frame on the wire — which is the hop
 * we are trying to remove. Safe to call more than once; throws if Reanimated
 * is not installed, so callers should treat failure as "stay on the JS path".
 */
export function installOnWorkletRuntime(): boolean {
  try {
    installOnUIRuntime();
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends from the UI thread. Reaches the module through the global registry
 * because `requireOptionalNativeModule` above is bound to the JS runtime.
 */
export function sendFromWorklet(text: string): boolean {
  'worklet';
  const module = (globalThis as any)?.expo?.modules?.EntangleUdp;
  if (!module) return false;
  return module.send(text) as boolean;
}
