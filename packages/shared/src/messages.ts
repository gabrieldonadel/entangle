import type { ModMask } from './constants';

export type ClickButton = 'left' | 'right';
export type ClickPhase = 'down' | 'up' | 'tap';
export type DragPhase = 'begin' | 'end';
export type ScrollPhase = 'begin' | 'change' | 'end';
export type SpaceDir = 'left' | 'right';
export type KeyPhase = 'down' | 'up' | 'tap';

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
  | 'F12';

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
  | PairQRMessage;

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

export interface WelcomeMessage {
  v: 1;
  t: 'welcome';
  server: { name: string; version: string; host: string };
  caps: string[];
  udp?: UdpOffer;
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
  | PairRejectedMessage;

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
