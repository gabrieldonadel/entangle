import { EventEmitter, requireOptionalNativeModule } from 'expo-modules-core';

export type VolumeButtonDirection = 'up' | 'down';

export type VolumeButtonEvent = { direction: VolumeButtonDirection };
export type VolumeButtonsUnavailableEvent = { reason: string };

export type VolumeButtonsEvents = {
  volumeButton: (event: VolumeButtonEvent) => void;
  volumeButtonsUnavailable: (event: VolumeButtonsUnavailableEvent) => void;
};

type NativeModuleType = {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  addListener(event: string): void;
  removeListeners(count: number): void;
};

// Apple-only module (see expo-module.config.json). On Android this resolves to
// null and every call below becomes a no-op, so callers do not have to branch.
const nativeModule = requireOptionalNativeModule<NativeModuleType>('VolumeButtons');

export const isSupported = nativeModule != null;

export const eventEmitter = nativeModule
  ? new EventEmitter<VolumeButtonsEvents>(nativeModule as any)
  : null;

export async function start(): Promise<void> {
  await nativeModule?.start();
}

export async function stop(): Promise<void> {
  await nativeModule?.stop();
}

export function isRunning(): boolean {
  return nativeModule?.isRunning() ?? false;
}

/**
 * Subscribe to presses. Returns an unsubscribe function; safe to call on
 * platforms without the native module, where it never fires.
 */
export function addVolumeButtonListener(
  listener: (direction: VolumeButtonDirection) => void,
): () => void {
  if (!eventEmitter) return () => undefined;
  const subscription = eventEmitter.addListener('volumeButton', (event) => {
    listener(event.direction);
  });
  return () => subscription.remove();
}

export function addUnavailableListener(
  listener: (reason: string) => void,
): () => void {
  if (!eventEmitter) return () => undefined;
  const subscription = eventEmitter.addListener(
    'volumeButtonsUnavailable',
    (event) => {
      listener(event.reason);
    },
  );
  return () => subscription.remove();
}
