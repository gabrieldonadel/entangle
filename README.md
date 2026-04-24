# Entangle

A free and open-source remote mouse application to control your desktop pointer from your phone.

This monorepo houses both clients:

| App     | Path                         | Platform      | Stack                             |
| ------- | ---------------------------- | ------------- | --------------------------------- |
| Desktop | [apps/desktop](apps/desktop) | macOS         | React Native macOS 0.78 + Expo 53 |
| Mobile  | [apps/mobile](apps/mobile)   | iOS / Android | Expo 55 + Expo Router             |

## Requirements

- Node.js ≥ 18
- pnpm 10
- Xcode (for macOS and iOS builds)
- CocoaPods (`bundle install && bundle exec pod install` inside `apps/desktop/macos`)

## Getting started

```sh
pnpm install
```

### Desktop (macOS)

```sh
pnpm desktop:start     # Metro bundler
pnpm desktop:macos     # build & run the macOS app
```

### Mobile

```sh
pnpm mobile:start      # Expo dev server
pnpm mobile:ios        # run on iOS simulator / device
pnpm mobile:android    # run on Android emulator / device
```

## Repository layout

```
entangle-monorepo/
├── apps/
│   ├── desktop/   # macOS client
│   └── mobile/    # iOS / Android client
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## Scripts

Run from the repo root:

- `pnpm desktop <cmd>` — forward a command into the desktop workspace
- `pnpm mobile <cmd>` — forward a command into the mobile workspace
- `pnpm lint` — lint every workspace
