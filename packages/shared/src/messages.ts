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
  dx: number;
  dy: number;
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

export interface WelcomeMessage {
  v: 1;
  t: 'welcome';
  server: { name: string; version: string; host: string };
  caps: string[];
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
  | PairAcceptedMessage
  | PairRejectedMessage;

export type Message = ClientMessage | ServerMessage;
