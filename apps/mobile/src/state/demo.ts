import type { DockApp } from "@entangle/protocol";

// Stylized "kind" identifiers for built-in vector icons rendered by
// DemoAppIcon when iconPng is empty.
export type DemoIconKind =
  | "android"
  | "xcode"
  | "cmux"
  | "chrome"
  | "vscode"
  | "slack"
  | "linear"
  | "mirror"
  | "wa"
  | "discord"
  | "sim"
  | "notes"
  | "finder"
  | "preview"
  | "activity"
  | "entangle";

export interface DemoAppMeta {
  bundleId: string;
  name: string;
  kind: DemoIconKind;
  bg: string;
}

export const DEMO_APPS: DemoAppMeta[] = [
  { bundleId: "demo.androidstudio", name: "Android Stu…", kind: "android", bg: "#ffffff" },
  { bundleId: "demo.xcode", name: "Xcode", kind: "xcode", bg: "#5cb9ff" },
  { bundleId: "demo.cmux", name: "cmux", kind: "cmux", bg: "#ffffff" },
  { bundleId: "demo.chrome", name: "Google Chr…", kind: "chrome", bg: "#ffffff" },
  { bundleId: "demo.vscode", name: "Visual Studi…", kind: "vscode", bg: "#ffffff" },
  { bundleId: "demo.slack", name: "Slack", kind: "slack", bg: "#ffffff" },
  { bundleId: "demo.linear", name: "Linear", kind: "linear", bg: "#000000" },
  { bundleId: "demo.mirror", name: "iPhone Mirr…", kind: "mirror", bg: "#7c83ff" },
  { bundleId: "demo.whatsapp", name: "WhatsApp", kind: "wa", bg: "#25d366" },
  { bundleId: "demo.discord", name: "Discord", kind: "discord", bg: "#5865f2" },
  { bundleId: "demo.simulator", name: "Simulator", kind: "sim", bg: "#4f9eff" },
  { bundleId: "demo.notes", name: "Notes", kind: "notes", bg: "#ffffff" },
  { bundleId: "demo.finder", name: "Finder", kind: "finder", bg: "#1d6dde" },
  { bundleId: "demo.preview", name: "Preview", kind: "preview", bg: "#9ec6f0" },
  { bundleId: "demo.activitymonitor", name: "Activity Mo…", kind: "activity", bg: "#1a1a1a" },
  { bundleId: "demo.entangle", name: "entangle", kind: "entangle", bg: "#0a0c10" },
];

export const DEMO_DOCK_APPS: DockApp[] = DEMO_APPS.map((app) => ({
  bundleId: app.bundleId,
  name: app.name,
  iconPng: "",
  running: true,
  pinned: true,
}));

export function getDemoIconKind(bundleId: string): DemoIconKind | null {
  const meta = DEMO_APPS.find((a) => a.bundleId === bundleId);
  return meta?.kind ?? null;
}

export function getDemoIconBg(bundleId: string): string | null {
  const meta = DEMO_APPS.find((a) => a.bundleId === bundleId);
  return meta?.bg ?? null;
}
