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

/** Longest edge for clipboard images before they are downscaled for the wire. */
export const CLIPBOARD_MAX_IMAGE_EDGE = 2048;
/** Max decoded PNG bytes (~1.3 MB on the wire after base64). Skip if still larger. */
export const CLIPBOARD_MAX_IMAGE_BYTES = 1_048_576;

/** Max UTF-8 bytes returned for a workspace file read over the wire. */
export const CURSOR_MAX_FILE_BYTES = 512_000;
/** Max directory entries returned by `cursor.file.list`. */
export const CURSOR_MAX_DIR_ENTRIES = 500;

export const ModFlags = {
  None: 0,
  Command: 1,
  Option: 2,
  Shift: 4,
  Control: 8,
  Fn: 16,
} as const;

export type ModMask = number;
