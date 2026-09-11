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
| [packages/entangle-udp](packages/entangle-udp) | `entangle-udp`       | Expo module: Swift + Kotlin datagram socket   |

Apps and shared packages all live in a single pnpm workspace ([pnpm-workspace.yaml](pnpm-workspace.yaml) declares `apps/*` and `packages/*`). One root [pnpm-lock.yaml](pnpm-lock.yaml), one install. `@entangle/protocol` is consumed via `"@entangle/protocol": "workspace:*"` and TypeScript `paths` — source-imported, no build step.

## Common commands

Run from repo root:

```sh
pnpm install                 # installs every workspace package
pnpm desktop:start           # Metro for desktop on port 8090
pnpm desktop:macos           # build & run macOS app (react-native run-macos)
pnpm mobile:start            # Expo dev server
pnpm mobile:ios              # expo run:ios
pnpm mobile:android          # expo run:android
pnpm desktop <cmd>           # forwards to apps/desktop (pnpm --filter entangle)
pnpm mobile <cmd>            # forwards to apps/mobile (pnpm --filter entangle-mobile)
pnpm lint                    # recursive lint across workspaces
```

Desktop tests use Jest:

```sh
pnpm desktop test                       # all
pnpm desktop test -- path/to/file.test  # single file
pnpm desktop test -- -t "name"          # by name
```

Mobile linting goes through Expo: `pnpm mobile lint` (i.e. `expo lint`).

The pointer diagnostics log path can be exercised without a phone or a real cursor — see the build command in [scripts/diag-harness/main.swift](scripts/diag-harness/main.swift). Keep that file out of `modules/entangle-server/ios`: the podspec globs `**/*.swift` there and a second `main` breaks the app build.

CocoaPods on first clone of desktop:

```sh
cd apps/desktop/macos && bundle install && bundle exec pod install
```

## How the install layout stays sane

Desktop and mobile pin **different** React / React Native versions (RN-macOS 0.81 + RN 0.83.6 on desktop, RN 0.83.4 on mobile; React 19.1 vs 19.2). Two things keep Metro from picking up a sibling app's copy:

- Root [.npmrc](.npmrc) sets `node-linker=hoisted` so pnpm produces flat `node_modules` trees (no top-level `.pnpm` symlinks). Shared deps hoist to the repo root; conflicting versions nest into the consuming app's `node_modules` (so `apps/desktop/node_modules/react-native` is the 0.83.6 it needs, not mobile's 0.83.4).
- Expo patches in [pnpm-workspace.yaml](pnpm-workspace.yaml) use version-pinned keys (e.g. `expo@55.0.17`) so the patch only matches the version desktop resolves to. **When desktop bumps Expo, update the patch key.**

Do not reintroduce `--ignore-workspace` or per-app `pnpm-lock.yaml` files — Xcode's archive script runs `node --print "require.resolve('@expo/cli')"` from `apps/desktop/`, and that only works when the install is a real workspace install (so `@expo/cli` hoists to the root `node_modules`).

## Shared protocol (`@entangle/protocol`)

[packages/shared/src](packages/shared/src) is the single source of truth for the wire format:

- [constants.ts](packages/shared/src/constants.ts) — `PROTOCOL_VERSION`, Bonjour service identifiers (`_entangle._tcp.`), `DEFAULT_PORT` (49827), heartbeat / idle timeouts, close codes, `ModFlags` bitmask.
- [messages.ts](packages/shared/src/messages.ts) — every `ClientMessage` and `ServerMessage` shape. All messages carry `v: 1` and a discriminator `t` (e.g. `'p.move'`, `'p.click'`, `'s.wheel'`, `'g.space'`, `'g.mission'`, `'k.text'`, `'k.key'`, `'a.set'`, `'a.step'`, `'a.mute'`, `'sys.wake'`, `'diag.set'`, `'diag.report'`, `'d.list'`, `'d.activate'`, `'hello'`, `'ping'`, and server-pushed `'state.audio'` / `'state.display'` / `'state.diag'`).
- [codec.ts](packages/shared/src/codec.ts) — encode/decode helpers used by both sides.
- [udp-policy.ts](packages/shared/src/udp-policy.ts) — when to trust the datagram path, pure and tested; it is the other half of the `udp.ok` contract.
- [metrics.ts](packages/shared/src/metrics.ts) — `percentile` / `summarize`, so the phone's diagnostics figures mean the same thing as the Mac's (which computes its own in Swift).

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
  - [Server/DatagramServer.swift](apps/desktop/modules/entangle-server/ios/Server/DatagramServer.swift) — UDP listener on the same port for pointer frames, with per-session tokens issued over the WebSocket.
  - [MessageDispatcher.swift](apps/desktop/modules/entangle-server/ios/MessageDispatcher.swift) — parses incoming JSON `ClientMessage`s and fans out to controllers.
  - [System/](apps/desktop/modules/entangle-server/ios/System) — `CursorController`, `PointerAccumulator`, `ScrollController`, `KeyController`, `GestureController`, `DockEnumerator` (CGEvent / Accessibility APIs), `VolumeController` (CoreAudio output volume + mute, needs no permission), `DisplayController` (display sleep state + `IOPMAssertionDeclareUserActivity` wake, needs no permission), `LatencyMonitor` (opt-in pointer-path measurement, off by default).
  - [Util/AccessibilityCheck.swift](apps/desktop/modules/entangle-server/ios/Util/AccessibilityCheck.swift), [Util/IconEncoder.swift](apps/desktop/modules/entangle-server/ios/Util/IconEncoder.swift), [Util/DiagLog.swift](apps/desktop/modules/entangle-server/ios/Util/DiagLog.swift) (appends the pointer log to `~/Library/Logs/Entangle/pointer-diag.jsonl`; `ENTANGLE_DIAG_LOG_DIR` redirects it).
- The TS facade is [modules/entangle-server/src/index.ts](apps/desktop/modules/entangle-server/src/index.ts) → `requireNativeModule('EntangleServer')`, re-exporting typed events.
- Metro [config](apps/desktop/metro.config.js) rewrites `react-native` → `react-native-macos` for the `macos` platform and prepends `react-native-macos/Libraries/Core/InitializeCore` to the run-before-main modules. Keep this when touching Metro config.
- Patched `expo` and `expo-modules-core` for macOS support — patches in [apps/desktop/patches](apps/desktop/patches), pinned to specific versions in the root [pnpm-workspace.yaml](pnpm-workspace.yaml).
- Desktop Metro runs on **port 8090** (not 8081) — see [package.json](apps/desktop/package.json) `start` script.

## Mobile architecture

- Expo Router app under [apps/mobile/src/app](apps/mobile/src/app):
  - [\_layout.tsx](apps/mobile/src/app/_layout.tsx) routes to `/connect` when the connection is `idle` and `/(tabs)` when `open`.
  - [connect.tsx](apps/mobile/src/app/connect.tsx) drives Bonjour discovery + connection.
  - [(tabs)/](<apps/mobile/src/app/(tabs)>) hosts trackpad / keyboard / dock surfaces.
- Feature surfaces in [src/features](apps/mobile/src/features) (`trackpad`, `keyboard`, `dock`, `diag`, `display`).
- The datagram socket is an Expo module in [packages/entangle-udp](packages/entangle-udp) (Swift + Kotlin), consumed as `"entangle-udp": "workspace:*"` like `@entangle/protocol`.
- **Keep its podspec's `s.platforms` at or below the app's iOS deployment target** (`platform :ios, '15.1'` in the generated Podfile). A pod that asks for a newer platform than the target is not an error: `use_expo_modules!` skips it with a yellow warning, `pod install` and the build both succeed, and the app ships with the native module missing — which only shows up at runtime. This cost two EAS builds. [scripts/verify-ios-module.sh](scripts/verify-ios-module.sh) checks a built `.ipa` for a module's symbols; run it before trusting a build that adds native code. `send` is a synchronous `Function`, not an `AsyncFunction`: it runs up to 120 times a second and a promise per frame would cost more than the frame.
- Networking in [src/net](apps/mobile/src/net): [discovery.ts](apps/mobile/src/net/discovery.ts) (Bonjour via `react-native-zeroconf`) and [send.ts](apps/mobile/src/net/send.ts) (WebSocket + queue).
- Zustand stores in [src/state](apps/mobile/src/state): `connection`, `audio`, `diag`, `display`, `dock`, `modifiers`, `settings`. AsyncStorage is used for persisted settings.
- Path alias `@/*` → `src/*` is set in TS only — Metro resolves through the default config, so prefer the alias for clarity.

## Conventions worth knowing

- Use the `@entangle/protocol` import on both sides; do not duplicate message shapes inline.
- All wire messages must include `v: 1`. Increment `PROTOCOL_VERSION` (and update both sides) for breaking changes.
- Modifier keys are sent as a `ModMask` bitfield using `ModFlags` (`Command|Option|Shift|Control|Fn`). Do not invent ad-hoc shapes.
- Single root `pnpm-lock.yaml`. Always run `pnpm install` from the repo root — never with `--ignore-workspace`.
- Pointer frames take the **datagram path** when the Mac offers one: `welcome.udp` hands over a port and a session token, the phone wraps each frame as `{v, tk, m}` and sends it over UDP ([packages/entangle-udp](packages/entangle-udp), [DatagramServer.swift](apps/desktop/modules/entangle-server/ios/Server/DatagramServer.swift)). Everything else — pairing, dock, audio, state, ping — stays on the WebSocket.
- The phone sends on **both** wires until the Mac confirms with `udp.ok`, and goes back to both if the confirmations stop; see [udp-policy.ts](packages/shared/src/udp-policy.ts). A blocked port is indistinguishable from a working one at the sending end, so never switch over without confirmation. Anything that acts on the cursor's position (a click, a drag boundary, a scroll) travels on the stream, so the phone puts the positioning frame on the stream too — ordering only holds within one transport.
- `p.move` carries both a per-frame delta (`dx`/`dy`) and the gesture's running total (`cx`/`cy` with a gesture counter `g`). The Mac prefers the total and applies `total - lastApplied` ([PointerAccumulator.swift](apps/desktop/modules/entangle-server/ios/System/PointerAccumulator.swift)), so a lost, duplicated or late frame costs nothing. Keep sending both: a Mac that predates `cx`/`cy` still tracks the cursor from the deltas.
- Pointer movement runs **on the UI thread** ([features/trackpad/uplink.ts](apps/mobile/src/features/trackpad/uplink.ts)). The gesture callbacks are worklets, state lives in shared values because a worklet gets a copy of module scope rather than a reference to it, and the datagram send is reachable from there because `expo-modules-core`'s `installOnUIRuntime()` puts the module registry into Reanimated's UI runtime. Measured cause: with the JS-thread hop, a 120 Hz phone delivered ~60 gesture callbacks a second.
- Only a **confirmed** datagram path is handed to the UI thread. While probing, frames go through the JS side so the stream copy can be sent, and a once-a-second watchdog (`reviewUdpPath`) is what notices confirmations stopping — no per-frame decision runs on the JS side while the UI thread is sending.
- The trackpad holds the display at its maximum refresh rate while a finger is down, with an empty `useFrameCallback`. Worklets runs its display link at `CAFrameRateRange(60, 120, 120)` on a ProMotion screen, but only while a callback is registered — a still screen idles at 60 Hz, and iOS delivers touches in step with the screen, which is what pinned the touch stream at 60 Hz.
- The onboarding lesson and the demo keep the JS path: they need a JavaScript callback per event. `Settings → UI-thread pointer` turns it off at runtime.
- Pointer sends are paced by a monotonic 4 ms rate limit in [gestures.ts](apps/mobile/src/features/trackpad/gestures.ts), not by `requestAnimationFrame`. RN's rAF is driven by the JS display link, which pins the send rate to 60 Hz even on a 120 Hz phone and adds a frame of quantization. Do not put it back.
- The pointer hot path (`p.move`, `s.wheel`, `k.*`, `ping`) is answered entirely in Swift and deliberately never reaches the desktop's JavaScript — `EntangleServerModule` emits aggregate counts once a second via `messageStats` instead. Keep it that way; a `sendEvent` per pointer frame costs a React render per cursor sample.
- Features the Mac may not have are gated on the `caps` list in the `welcome` message (`audio`, `wake`, …). Add a cap in [src/server-state.ts](apps/desktop/src/server-state.ts) and check it on the phone, so an older Mac never shows a dead control.
- Native input synthesis requires the user to grant macOS Accessibility — `AccessibilityGate` blocks the UI until `isAccessibilityTrusted()` returns true.
