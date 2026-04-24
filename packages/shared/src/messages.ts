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

export type ClientMessage =
  | PointerMoveMessage
  | PointerClickMessage
  | PointerDragMessage
  | ScrollMessage
  | SpaceGestureMessage
  | MissionGestureMessage
  | KeyTextMessage
  | KeyPressMessage
  | DockListRequestMessage
  | DockActivateMessage
  | HelloMessage
  | PingMessage;

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

export type ServerMessage =
  | WelcomeMessage
  | PongMessage
  | ErrorMessage
  | DockListResponseMessage
  | DockUpdateMessage
  | ModStateMessage;

export type Message = ClientMessage | ServerMessage;
