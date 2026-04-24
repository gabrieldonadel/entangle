declare module 'react-native-zeroconf' {
  export interface ZeroconfService {
    name: string;
    fullName?: string;
    host?: string;
    port?: number;
    addresses?: string[];
    txt?: Record<string, string>;
  }

  type EventName = 'start' | 'stop' | 'found' | 'resolved' | 'remove' | 'update' | 'error';

  export default class Zeroconf {
    scan(type?: string, protocol?: string, domain?: string): void;
    stop(): void;
    removeDeviceListeners(): void;
    on(event: 'start', listener: () => void): void;
    on(event: 'stop', listener: () => void): void;
    on(event: 'found', listener: (name: string) => void): void;
    on(event: 'resolved', listener: (service: ZeroconfService) => void): void;
    on(event: 'remove', listener: (name: string) => void): void;
    on(event: 'update', listener: () => void): void;
    on(event: 'error', listener: (error: unknown) => void): void;
    on(event: EventName, listener: (...args: unknown[]) => void): void;
    removeListener(event: EventName, listener: (...args: unknown[]) => void): void;
  }
}
