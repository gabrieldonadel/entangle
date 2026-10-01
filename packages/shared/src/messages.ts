import type { ModMask } from './constants';

export type ClickButton = 'left' | 'right';
export type ClickPhase = 'down' | 'up' | 'tap';
export type DragPhase = 'begin' | 'end';
export type ScrollPhase = 'begin' | 'change' | 'end';
export type SpaceDir = 'left' | 'right';
export type KeyPhase = 'down' | 'up' | 'tap';

/**
 * Key identifiers on the wire, named after `KeyboardEvent.code`. Letters,
 * digits and punctuation exist so a modifier can be combined with an ordinary
 * character — `k.text` carries no mask, so ⌘C cannot be expressed as text.
 * Servers that predate these codes do not advertise the `shortcuts` cap.
 */
export type KeyCode =
  | 'Escape'
  | 'Tab'
  | 'Return'
  | 'Backspace'
  | 'Delete'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Space'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown'
  | 'F1'
  | 'F2'
  | 'F3'
  | 'F4'
  | 'F5'
  | 'F6'
  | 'F7'
  | 'F8'
  | 'F9'
  | 'F10'
  | 'F11'
  | 'F12'
  | LetterKeyCode
  | DigitKeyCode
  | PunctuationKeyCode;

export type LetterKeyCode =
  | 'KeyA' | 'KeyB' | 'KeyC' | 'KeyD' | 'KeyE' | 'KeyF' | 'KeyG'
  | 'KeyH' | 'KeyI' | 'KeyJ' | 'KeyK' | 'KeyL' | 'KeyM' | 'KeyN'
  | 'KeyO' | 'KeyP' | 'KeyQ' | 'KeyR' | 'KeyS' | 'KeyT' | 'KeyU'
  | 'KeyV' | 'KeyW' | 'KeyX' | 'KeyY' | 'KeyZ';

export type DigitKeyCode =
  | 'Digit0' | 'Digit1' | 'Digit2' | 'Digit3' | 'Digit4'
  | 'Digit5' | 'Digit6' | 'Digit7' | 'Digit8' | 'Digit9';

export type PunctuationKeyCode =
  | 'Minus'
  | 'Equal'
  | 'BracketLeft'
  | 'BracketRight'
  | 'Backslash'
  | 'Semicolon'
  | 'Quote'
  | 'Backquote'
  | 'Comma'
  | 'Period'
  | 'Slash';

export interface PointerMoveMessage {
  v: 1;
  t: 'p.move';
  /**
   * Movement since the previous frame. Kept for servers that predate `cx`/`cy`
   * — a Mac that ignores the cumulative fields still tracks the cursor
   * correctly from these.
   */
  dx: number;
  dy: number;
  /**
   * Total movement since this gesture began. Authoritative when present: the
   * server applies `cumulative - lastApplied`, so a frame that is lost,
   * duplicated or delivered late costs nothing — the next frame carries the
   * whole truth. Only meaningful alongside `g`.
   */
  cx?: number;
  cy?: number;
  /**
   * Gesture counter, incremented for every new gesture. A change means the
   * cumulative total restarted from zero. Sent on every frame rather than
   * only the first, so the boundary survives a lost packet.
   */
  g?: number;
  /**
   * Frame counter, monotonic for the life of the connection. The server drops
   * a frame whose `seq` it has already passed, so a duplicate or a late
   * arrival cannot drag the cursor backwards.
   */
  seq: number;
  /**
   * Client-monotonic send time in milliseconds, present only while
   * diagnostics are on. The Mac never compares it against its own clock —
   * only successive `ts` differences against successive arrival differences,
   * which measures delay variation without needing the two clocks to agree.
   */
  ts?: number;
}

export interface PointerClickMessage {
  v: 1;
  t: 'p.click';
  button: ClickButton;
  phase: ClickPhase;
}

export interface PointerDragMessage {
  v: 1;
  t: 'p.drag';
  phase: DragPhase;
}

export interface ScrollMessage {
  v: 1;
  t: 's.wheel';
  dx: number;
  dy: number;
  phase: ScrollPhase;
}

export interface SpaceGestureMessage {
  v: 1;
  t: 'g.space';
  dir: SpaceDir;
}

export interface MissionGestureMessage {
  v: 1;
  t: 'g.mission';
}

export interface KeyTextMessage {
  v: 1;
  t: 'k.text';
  text: string;
}

export interface KeyPressMessage {
  v: 1;
  t: 'k.key';
  code: KeyCode;
  phase: KeyPhase;
  mods: ModMask;
}

export type VolumeDir = 'up' | 'down';

/** Set the Mac's output volume to an absolute level in the 0…1 range. */
export interface AudioSetMessage {
  v: 1;
  t: 'a.set';
  level: number;
}

/**
 * Nudge the Mac's output volume one step. Used by the phone's hardware volume
 * buttons, which report a direction rather than a level.
 */
export interface AudioStepMessage {
  v: 1;
  t: 'a.step';
  dir: VolumeDir;
}

/** Mute or unmute the Mac. Omit `muted` to toggle. */
export interface AudioMuteMessage {
  v: 1;
  t: 'a.mute';
  muted?: boolean;
}

/**
 * Wake the Mac's display. Sent when the phone sees `state.display` report the
 * screen as asleep — a pointer move would otherwise land on a dark screen.
 */
export interface SystemWakeMessage {
  v: 1;
  t: 'sys.wake';
}

/**
 * Turn per-move instrumentation on or off. Off by default: it costs a
 * timestamp on every pointer frame and a `state.diag` push every second.
 */
export interface DiagSetMessage {
  v: 1;
  t: 'diag.set';
  on: boolean;
}

/**
 * The phone's own half of the diagnostics, once a second while they are on.
 *
 * Sent so both sides land in the same log line on the Mac: the phone is the
 * only one that can measure how often it sends and what the round trip is.
 */
export interface DiagReportMessage {
  v: 1;
  t: 'diag.report';
  /** Pointer messages put on the wire in the last second. */
  sendRate: number;
  /**
   * Raw gesture callbacks in the last second, before coalescing. Sending
   * fewer than this means the phone is discarding touch samples; sending the
   * same means the wire is carrying everything the OS reports.
   */
  touchRate: number;
  rttP50: number;
  rttP95: number;
  /**
   * Whether pointer frames are leaving from the UI thread. In the log next to
   * everything else, because working out which half of an A/B a line belongs
   * to from the numbers themselves is guesswork.
   */
  uiThread: boolean;
  /** Whether the phone is holding the display at its maximum refresh rate. */
  highRefresh: boolean;
}

export interface DockListRequestMessage {
  v: 1;
  t: 'd.list';
}

export interface DockActivateMessage {
  v: 1;
  t: 'd.activate';
  bundleId: string;
}

export interface HelloMessage {
  v: 1;
  t: 'hello';
  client: {
    name: string;
    platform: 'ios' | 'android' | 'macos' | 'web';
    version: string;
  };
}

export interface PingMessage {
  v: 1;
  t: 'ping';
  id: number;
}

export interface PairRequestMessage {
  v: 1;
  t: 'pair.request';
  code: string;
}

export interface PairQRMessage {
  v: 1;
  t: 'pair.qr';
  token: string;
}

export type CursorAgentStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'finished'
  | 'error'
  | 'cancelled';

export type CursorDeltaKind = 'assistant' | 'thinking' | 'tool' | 'shell' | 'result';

export type CursorTokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
};

export type CursorModelParam = {
  id: string;
  type?: string;
  displayName?: string;
  description?: string;
  values?: { id: string; label?: string }[];
};

export type CursorModelInfo = {
  id: string;
  displayName: string;
  description?: string;
  params?: CursorModelParam[];
};

export type CursorAgentListItem = {
  agentId: string;
  name: string;
  summary: string;
  lastModified: number;
  status?: string;
};

/** Start a new local Cursor agent run, or send a follow-up on an existing agent. */
/** Image attachment for a Cursor prompt (base64, no data: prefix). */
export type CursorPromptImage = {
  data: string;
  mimeType: string;
};

export interface CursorPromptMessage {
  v: 1;
  t: 'cursor.prompt';
  text: string;
  /** When set, continue this agent; otherwise the Mac starts a fresh one. */
  agentId?: string;
  /** Optional images attached to this turn (SDK `SDKUserMessage.images`). */
  images?: CursorPromptImage[];
}

/** Cancel the in-flight Cursor run on the Mac. */
export interface CursorCancelMessage {
  v: 1;
  t: 'cursor.cancel';
}

/** Reattach to the last persisted local agent on the Mac (if any). */
export interface CursorResumeMessage {
  v: 1;
  t: 'cursor.resume';
}

/** Ask the Mac for the current Cursor status + transcript snapshot. */
export interface CursorGetMessage {
  v: 1;
  t: 'cursor.get';
}

/** Request models available to the Mac's API key. */
export interface CursorModelsRequestMessage {
  v: 1;
  t: 'cursor.models';
}

/** Change the model (and optional params) used for the next prompt. */
export interface CursorSetModelMessage {
  v: 1;
  t: 'cursor.setModel';
  modelId: string;
  params?: { id: string; value: string }[];
}

/** Request billed usage for the active or named agent. */
export interface CursorUsageRequestMessage {
  v: 1;
  t: 'cursor.usage';
  agentId?: string;
}

/** Request account info for the Mac's API key. */
export interface CursorMeMessage {
  v: 1;
  t: 'cursor.me';
}

/** List past local agents for this workspace (IDE-like chat history). */
export interface CursorListMessage {
  v: 1;
  t: 'cursor.list';
  cursor?: string;
  limit?: number;
}

/** Open / resume a past local agent and load its transcript. */
export interface CursorOpenMessage {
  v: 1;
  t: 'cursor.open';
  agentId: string;
}

/** Start a fresh chat (dispose current agent, clear transcript). */
export interface CursorNewMessage {
  v: 1;
  t: 'cursor.new';
}

/** Ask the Mac for the allowlisted workspaces phones may use. */
export interface CursorWorkspacesRequestMessage {
  v: 1;
  t: 'cursor.workspaces';
}

/**
 * Switch the active Cursor workspace (must be on the Mac allowlist).
 * Chats / agents are scoped to the new cwd after this.
 */
export interface CursorSetWorkspaceMessage {
  v: 1;
  t: 'cursor.setWorkspace';
  path: string;
}

export type CursorFileOp = 'read' | 'write' | 'other';

/** Ask the Mac for the UTF-8 contents of a workspace file. */
export interface CursorFileGetMessage {
  v: 1;
  t: 'cursor.file.get';
  /** Workspace-relative or absolute path under the Cursor workspace. */
  path: string;
}

/** List files/folders under a workspace directory (default: workspace root). */
export interface CursorFileListMessage {
  v: 1;
  t: 'cursor.file.list';
  /** Relative or absolute directory under the workspace. Empty / omit = root. */
  path?: string;
}

/** Keep (accept) pending agent edits. Omit / empty paths = keep all. */
export interface CursorKeepMessage {
  v: 1;
  t: 'cursor.keep';
  paths?: string[];
}

/** Discard (revert) pending agent edits. Omit / empty paths = discard all. */
export interface CursorDiscardMessage {
  v: 1;
  t: 'cursor.discard';
  paths?: string[];
}

/** Refresh the pending-diff list from the Mac. */
export interface CursorDiffsRequestMessage {
  v: 1;
  t: 'cursor.diffs';
}

export type ClipboardKind = 'text' | 'image' | 'empty';

/**
 * Phone opts into automatic clipboard sync for this session.
 * Mac only auto-pushes to clients with sync on, and only applies pushes from them.
 */
export interface ClipboardSyncMessage {
  v: 1;
  t: 'cb.sync';
  on: boolean;
}

/**
 * Clipboard payload in either direction. Image wins when both text and image
 * are present. `gen` is monotonic per sender; receivers ignore stale/duplicate gens.
 */
export interface ClipboardPushMessage {
  v: 1;
  t: 'cb.push';
  kind: ClipboardKind;
  text?: string;
  /** Raw base64 PNG (same convention as dock `iconPng`). */
  imagePng?: string;
  gen: number;
}

export type ClientMessage =
  | PointerMoveMessage
  | PointerClickMessage
  | PointerDragMessage
  | ScrollMessage
  | SpaceGestureMessage
  | MissionGestureMessage
  | KeyTextMessage
  | KeyPressMessage
  | AudioSetMessage
  | AudioStepMessage
  | AudioMuteMessage
  | SystemWakeMessage
  | DiagSetMessage
  | DiagReportMessage
  | DockListRequestMessage
  | DockActivateMessage
  | HelloMessage
  | PingMessage
  | PairRequestMessage
  | PairQRMessage
  | CursorPromptMessage
  | CursorCancelMessage
  | CursorResumeMessage
  | CursorGetMessage
  | CursorModelsRequestMessage
  | CursorSetModelMessage
  | CursorUsageRequestMessage
  | CursorMeMessage
  | CursorListMessage
  | CursorOpenMessage
  | CursorNewMessage
  | CursorWorkspacesRequestMessage
  | CursorSetWorkspaceMessage
  | CursorFileGetMessage
  | CursorFileListMessage
  | CursorKeepMessage
  | CursorDiscardMessage
  | CursorDiffsRequestMessage
  | ClipboardSyncMessage
  | ClipboardPushMessage;

export interface DockApp {
  bundleId: string;
  name: string;
  iconPng: string;
  running: boolean;
  pinned: boolean;
  path?: string;
}

/**
 * How to reach this Mac's datagram socket, offered in `welcome`.
 *
 * Absent on a Mac that has no UDP listener, in which case the phone keeps
 * sending pointer frames over the WebSocket.
 */
export interface UdpOffer {
  port: number;
  /**
   * Session token. Every datagram carries it, and it dies with the socket
   * that issued it — a LAN datagram is otherwise trivially spoofable, and
   * this is an input device.
   */
  token: string;
}

/**
 * Optional app icons (raw base64 PNG, same convention as dock `iconPng`)
 * keyed by integration id. Present when the Mac can resolve the .app on disk.
 */
export type WelcomeIcons = {
  cursor?: string;
};

export interface WelcomeMessage {
  v: 1;
  t: 'welcome';
  server: { name: string; version: string; host: string };
  caps: string[];
  udp?: UdpOffer;
  icons?: WelcomeIcons;
}

export interface PongMessage {
  v: 1;
  t: 'pong';
  id: number;
}

export interface ErrorMessage {
  v: 1;
  t: 'error';
  code: string;
  message: string;
}

export interface DockListResponseMessage {
  v: 1;
  t: 'd.list';
  apps: DockApp[];
}

export interface DockUpdateMessage {
  v: 1;
  t: 'd.update';
  added?: DockApp[];
  removed?: string[];
  changed?: Partial<DockApp>[];
}

export interface ModStateMessage {
  v: 1;
  t: 'state.mods';
  mods: ModMask;
}

/**
 * The Mac's current output volume. Pushed on connect and whenever the level or
 * mute state changes — including changes made on the Mac itself — so the phone
 * never shows a stale slider.
 */
export interface AudioStateMessage {
  v: 1;
  t: 'state.audio';
  level: number;
  muted: boolean;
}

/**
 * Whether the Mac's display is asleep. Pushed on connect and whenever the
 * screens sleep or wake, so the phone can offer to wake the Mac instead of
 * moving a cursor nobody can see.
 */
export interface DisplayStateMessage {
  v: 1;
  t: 'state.display';
  asleep: boolean;
}

/**
 * One second of pointer-path measurements from the Mac. Pushed only while
 * diagnostics are on.
 *
 * Every figure is measured on the Mac's own clock, so none of them depend on
 * the two devices agreeing about the time. Round-trip time is the phone's to
 * measure.
 */
export interface DiagStateMessage {
  v: 1;
  t: 'state.diag';
  /** Pointer moves applied in the last second. */
  rate: number;
  /** Gap between consecutive moves, milliseconds. */
  gapP50: number;
  gapP95: number;
  /**
   * Mean absolute one-way delay variation, milliseconds: how much the gap
   * between two arrivals differed from the gap between the two sends. Zero
   * means the stream arrived exactly as evenly as it was sent.
   */
  jitter: number;
  /** Arrival to CGEvent posted, milliseconds. */
  procP50: number;
  procP95: number;
  /** Gaps longer than 50 ms in the last second — the "freeze then jump". */
  stalls: number;
  /**
   * Where the Mac is appending the log, so the phone can say where to look.
   * Absent if the log could not be opened.
   */
  logPath?: string;
}

/**
 * Sent about once a second while datagrams are actually arriving.
 *
 * This is the phone's only proof that the datagram path works. A blocked port
 * looks exactly like a working one from the sending side, so without this the
 * pointer would die silently the first time a firewall got in the way.
 */
export interface UdpOkMessage {
  v: 1;
  t: 'udp.ok';
  /** Datagrams received since the last one of these. */
  frames: number;
}

export interface PairAcceptedMessage {
  v: 1;
  t: 'pair.accepted';
}

export interface PairRejectedMessage {
  v: 1;
  t: 'pair.rejected';
  reason: string;
}

export interface CursorStatusMessage {
  v: 1;
  t: 'cursor.status';
  status: CursorAgentStatus;
  agentId?: string;
  runId?: string;
  cwd?: string;
  model?: string;
  error?: string;
  /** Token counts for the turn that just finished, when available. */
  usage?: CursorTokenUsage;
}

export interface CursorDeltaMessage {
  v: 1;
  t: 'cursor.delta';
  kind: CursorDeltaKind;
  text: string;
  agentId: string;
  runId: string;
}

export interface CursorTranscriptItem {
  role: 'user' | 'assistant' | 'thinking' | 'tool' | 'shell' | 'result';
  text: string;
}

export interface CursorSnapshotMessage {
  v: 1;
  t: 'cursor.snapshot';
  status: CursorAgentStatus;
  agentId?: string;
  runId?: string;
  cwd?: string;
  model?: string;
  error?: string;
  transcript: CursorTranscriptItem[];
}

export interface CursorModelsMessage {
  v: 1;
  t: 'cursor.models';
  models: CursorModelInfo[];
}

export interface CursorUsageMessage {
  v: 1;
  t: 'cursor.usage';
  agentId?: string;
  usage: CursorTokenUsage;
  costCents?: number;
  runs?: {
    runId: string;
    usage: CursorTokenUsage;
    costCents?: number;
  }[];
  /** Set when billed usage could not be loaded (e.g. feature_unavailable). */
  error?: string;
}

export interface CursorAccountMessage {
  v: 1;
  t: 'cursor.account';
  apiKeyName?: string;
  userEmail?: string;
  userId?: number | null;
  /** Set when the Mac could not load account details. */
  error?: string;
}

export interface CursorAgentsMessage {
  v: 1;
  t: 'cursor.agents';
  items: CursorAgentListItem[];
  nextCursor?: string;
}

/** One folder the Mac has allowlisted for phone Cursor use. */
export type CursorWorkspaceInfo = {
  path: string;
  /** Basename for display (e.g. `entangle` or `Partners` for a `.code-workspace`). */
  name: string;
  /** Present when the Mac distinguishes folders from multi-root workspace files. */
  kind?: 'folder' | 'code-workspace';
};

/** Allowlisted workspaces + which one is active. */
export interface CursorWorkspacesMessage {
  v: 1;
  t: 'cursor.workspaces';
  workspaces: CursorWorkspaceInfo[];
  /** Absolute path of the active workspace, when set. */
  active?: string;
}

/** Mac notifies the phone that the agent touched workspace paths. */
export interface CursorFilesMessage {
  v: 1;
  t: 'cursor.files';
  files: { path: string; op: CursorFileOp }[];
  agentId?: string;
  runId?: string;
}

/** One pending file change awaiting Keep / Discard. */
export type CursorPendingDiff = {
  path: string;
  /** Unified diff text (---/+++ / @@ / ± lines). */
  diff: string;
  linesAdded: number;
  linesRemoved: number;
};

/** Pending review set for agent edits (like desktop Keep All / Discard). */
export interface CursorDiffsMessage {
  v: 1;
  t: 'cursor.diffs';
  files: CursorPendingDiff[];
  agentId?: string;
  runId?: string;
  /** Paths just kept, when this update follows a keep. */
  kept?: string[];
  /** Paths just discarded, when this update follows a discard. */
  discarded?: string[];
  error?: string;
}

/** Response to `cursor.file.get`. */
export interface CursorFileMessage {
  v: 1;
  t: 'cursor.file';
  path: string;
  /** Present when the file was read as text. */
  text?: string;
  truncated?: boolean;
  binary?: boolean;
  bytes?: number;
  error?: string;
  /** When the file is a previewable image under the size cap. */
  imageBase64?: string;
  mimeType?: string;
}

export type CursorDirEntryKind = 'file' | 'dir';

/** Response to `cursor.file.list`. */
export interface CursorFileListingMessage {
  v: 1;
  t: 'cursor.file.listing';
  path: string;
  entries: { name: string; kind: CursorDirEntryKind; size?: number }[];
  error?: string;
}

export type ServerMessage =
  | WelcomeMessage
  | PongMessage
  | ErrorMessage
  | DockListResponseMessage
  | DockUpdateMessage
  | ModStateMessage
  | AudioStateMessage
  | DisplayStateMessage
  | DiagStateMessage
  | UdpOkMessage
  | PairAcceptedMessage
  | PairRejectedMessage
  | CursorStatusMessage
  | CursorDeltaMessage
  | CursorSnapshotMessage
  | CursorModelsMessage
  | CursorUsageMessage
  | CursorAccountMessage
  | CursorAgentsMessage
  | CursorWorkspacesMessage
  | CursorFilesMessage
  | CursorDiffsMessage
  | CursorFileMessage
  | CursorFileListingMessage
  | ClipboardPushMessage;

export type Message = ClientMessage | ServerMessage;

/**
 * A pointer frame on the datagram path.
 *
 * The token lives in the envelope rather than in the message so the
 * authentication boundary stays visible and the message shapes stay identical
 * on both transports.
 */
export interface Datagram {
  v: 1;
  tk: string;
  m: ClientMessage;
}
