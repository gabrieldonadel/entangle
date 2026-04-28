# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Entangle is a remote-mouse system: a macOS desktop "server" exposes a WebSocket on the LAN; phones discover it via Bonjour and send pointer/keyboard/dock messages. Three apps + one shared package, each app stays on its own React Native / Expo line.

| Path                               | Name                 | Stack                                         |
| ---------------------------------- | -------------------- | --------------------------------------------- |
| [apps/desktop](apps/desktop)       | `entangle`           | React Native macOS 0.81 + Expo 55, React 19.1 |
| [apps/mobile](apps/mobile)         | `entangle-mobile`    | Expo 55 + Expo Router + RN 0.83, React 19.2   |
| [apps/website](apps/website)       | `@entangle/website`  | Vite + React 18                               |
| [packages/shared](packages/shared) | `@entangle/protocol` | TS-only, source-imported (no build step)      |

The pnpm workspace at the repo root only contains `packages/*`. **Each app is outside the workspace** and has its own [pnpm-workspace.yaml](apps/mobile/pnpm-workspace.yaml) with empty `packages: []` plus `pnpm-lock.yaml`. The shared package is consumed via `"@entangle/protocol": "link:../../packages/shared"` and TypeScript `paths`. This isolation is intentional — see "Why apps are isolated" below.

## Common commands

Run from repo root:

```sh
pnpm install                 # installs the root workspace (just packages/shared)
pnpm desktop:start           # Metro for desktop on port 8090
pnpm desktop:macos           # build & run macOS app (react-native run-macos)
pnpm mobile:start            # Expo dev server
pnpm mobile:ios              # expo run:ios
pnpm mobile:android          # expo run:android
pnpm desktop <cmd>           # forwards to apps/desktop (pnpm --filter entangle)
pnpm mobile <cmd>            # forwards to apps/mobile (pnpm --filter entangle-mobile)
pnpm lint                    # recursive lint across workspaces
```

Inside an app — install with `--ignore-workspace` so it uses its own lockfile:

```sh
cd apps/desktop && pnpm install --ignore-workspace
cd apps/mobile  && pnpm install --ignore-workspace
```

Desktop tests use Jest:

```sh
pnpm desktop test                       # all
pnpm desktop test -- path/to/file.test  # single file
pnpm desktop test -- -t "name"          # by name
```

Mobile linting goes through Expo: `pnpm mobile lint` (i.e. `expo lint`).

CocoaPods on first clone of desktop:

```sh
cd apps/desktop/macos && bundle install && bundle exec pod install
```

## Why apps are isolated (do not "fix" this)

Desktop and mobile pin **different** React / React Native versions (RN 0.81 vs 0.83, React 19.1 vs 19.2). With pnpm's default symlink layout, Metro's resolver walks across the symlinked workspace and picks up the wrong copy of `react-native` from the sibling app's hoisted tree. The fix in place:

- Root [.npmrc](.npmrc) sets `node-linker=hoisted` so each install produces a flat `node_modules`.
- Apps live outside the root workspace; each does its own install with `--ignore-workspace`.
- Only `packages/*` is in the root workspace.
- `@entangle/protocol` is a `link:` dependency (not `workspace:`), source-imported via TS `paths`, so no build step is needed.

If you change dependency wiring, preserve all four properties or Metro will resolve the wrong RN.

## Shared protocol (`@entangle/protocol`)

[packages/shared/src](packages/shared/src) is the single source of truth for the wire format:

- [constants.ts](packages/shared/src/constants.ts) — `PROTOCOL_VERSION`, Bonjour service identifiers (`_entangle._tcp.`), `DEFAULT_PORT` (49827), heartbeat / idle timeouts, close codes, `ModFlags` bitmask.
- [messages.ts](packages/shared/src/messages.ts) — every `ClientMessage` and `ServerMessage` shape. All messages carry `v: 1` and a discriminator `t` (e.g. `'p.move'`, `'p.click'`, `'s.wheel'`, `'g.space'`, `'g.mission'`, `'k.text'`, `'k.key'`, `'d.list'`, `'d.activate'`, `'hello'`, `'ping'`).
- [codec.ts](packages/shared/src/codec.ts) — encode/decode helpers used by both sides.

Both apps reach this via TS path aliases:

- desktop [tsconfig.json](apps/desktop/tsconfig.json): `@entangle/protocol` → `../../packages/shared/src`
- mobile [tsconfig.json](apps/mobile/tsconfig.json): same, plus `@/*` → `./src/*`

When changing the protocol, update [packages/shared/src](packages/shared/src) once and adjust both senders (mobile [src/net/send.ts](apps/mobile/src/net/send.ts)) and the receiver ([apps/desktop/modules/entangle-server/ios/MessageDispatcher.swift](apps/desktop/modules/entangle-server/ios/MessageDispatcher.swift)). Bump `PROTOCOL_VERSION` for breaking changes — server closes mismatched clients with `CLOSE_CODE_PROTOCOL_MISMATCH` (4001).

## Desktop architecture

The macOS app is a thin RN-macOS shell over a Swift Expo module that does the real work.

- [App.tsx](apps/desktop/App.tsx) drives a Zustand store in [src/server-state.ts](apps/desktop/src/server-state.ts) that auto-starts the server on launch, gated by [src/components/AccessibilityGate.tsx](apps/desktop/src/components/AccessibilityGate.tsx) (macOS Accessibility permission is required to synthesize input).
- The native module lives at [apps/desktop/modules/entangle-server](apps/desktop/modules/entangle-server) — local Expo module, Apple-only ([expo-module.config.json](apps/desktop/modules/entangle-server/expo-module.config.json)).
  - [EntangleServerModule.swift](apps/desktop/modules/entangle-server/ios/EntangleServerModule.swift) — Expo `Module` definition, exposes `startServer / stopServer / sendToClient / broadcast / isAccessibilityTrusted / promptAccessibility` and emits `clientConnected / clientDisconnected / message / error / serverReady / accessibilityChanged`.
  - [Server/WebSocketServer.swift](apps/desktop/modules/entangle-server/ios/Server/WebSocketServer.swift) — listens on `DEFAULT_PORT`, advertises Bonjour, manages clients & heartbeats.
  - [MessageDispatcher.swift](apps/desktop/modules/entangle-server/ios/MessageDispatcher.swift) — parses incoming JSON `ClientMessage`s and fans out to controllers.
  - [System/](apps/desktop/modules/entangle-server/ios/System) — `CursorController`, `ScrollController`, `KeyController`, `GestureController`, `DockEnumerator` (CGEvent / Accessibility APIs).
  - [Util/AccessibilityCheck.swift](apps/desktop/modules/entangle-server/ios/Util/AccessibilityCheck.swift), [Util/IconEncoder.swift](apps/desktop/modules/entangle-server/ios/Util/IconEncoder.swift).
- The TS facade is [modules/entangle-server/src/index.ts](apps/desktop/modules/entangle-server/src/index.ts) → `requireNativeModule('EntangleServer')`, re-exporting typed events.
- Metro [config](apps/desktop/metro.config.js) rewrites `react-native` → `react-native-macos` for the `macos` platform and prepends `react-native-macos/Libraries/Core/InitializeCore` to the run-before-main modules. Keep this when touching Metro config.
- A patched `expo-modules-core` is applied via [patches/expo-modules-core.patch](apps/desktop/patches/expo-modules-core.patch) (declared in [pnpm-workspace.yaml](apps/desktop/pnpm-workspace.yaml)).
- Desktop Metro runs on **port 8090** (not 8081) — see [package.json](apps/desktop/package.json) `start` script.

## Mobile architecture

- Expo Router app under [apps/mobile/src/app](apps/mobile/src/app):
  - [\_layout.tsx](apps/mobile/src/app/_layout.tsx) routes to `/connect` when the connection is `idle` and `/(tabs)` when `open`.
  - [connect.tsx](apps/mobile/src/app/connect.tsx) drives Bonjour discovery + connection.
  - [(tabs)/](<apps/mobile/src/app/(tabs)>) hosts trackpad / keyboard / dock surfaces.
- Feature surfaces in [src/features](apps/mobile/src/features) (`trackpad`, `keyboard`, `dock`).
- Networking in [src/net](apps/mobile/src/net): [discovery.ts](apps/mobile/src/net/discovery.ts) (Bonjour via `react-native-zeroconf`) and [send.ts](apps/mobile/src/net/send.ts) (WebSocket + queue).
- Zustand stores in [src/state](apps/mobile/src/state): `connection`, `dock`, `modifiers`, `settings`. AsyncStorage is used for persisted settings.
- Path alias `@/*` → `src/*` is set in TS only — Metro resolves through the default config, so prefer the alias for clarity.

## Conventions worth knowing

- Use the `@entangle/protocol` import on both sides; do not duplicate message shapes inline.
- All wire messages must include `v: 1`. Increment `PROTOCOL_VERSION` (and update both sides) for breaking changes.
- Modifier keys are sent as a `ModMask` bitfield using `ModFlags` (`Command|Option|Shift|Control|Fn`). Do not invent ad-hoc shapes.
- Do not commit changes to per-app `pnpm-lock.yaml` from a root install — install inside the app with `--ignore-workspace`.
- Native input synthesis requires the user to grant macOS Accessibility — `AccessibilityGate` blocks the UI until `isAccessibilityTrusted()` returns true.
