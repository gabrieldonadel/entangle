export const PROTOCOL_VERSION = 1;

export const BONJOUR_SERVICE_TYPE = '_entangle._tcp.';
export const BONJOUR_SERVICE_NAME = 'entangle';
export const BONJOUR_PROTOCOL = 'tcp';
export const BONJOUR_DOMAIN = 'local.';

export const DEFAULT_PORT = 49827;

export const HEARTBEAT_INTERVAL_MS = 3000;
export const HEARTBEAT_TIMEOUT_MS = 2000;
export const IDLE_DISCONNECT_MS = 10000;

export const CLOSE_CODE_PROTOCOL_MISMATCH = 4001;
export const CLOSE_CODE_IDLE = 4002;

export const ModFlags = {
  None: 0,
  Command: 1,
  Option: 2,
  Shift: 4,
  Control: 8,
  Fn: 16,
} as const;

export type ModMask = number;
