export type Theme = "dark" | "light";

export type AppView = "trackpad" | "dock" | "settings";

export type CursorPos = { x: number; y: number };

export type TrackpadDragData =
  | { dragging: false }
  | { dragging: true; x: number; y: number };

export type TrackpadDragHandler = (data: TrackpadDragData) => void;
