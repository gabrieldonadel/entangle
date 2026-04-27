# Entangle — App Icon Assets

iOS 26 / macOS Tahoe layered icon assets, ready to assemble in Icon Composer.

## What's included

```
entangle-icon-assets/
├── halos.svg        — Soft outer glow (back layer)
├── wave.svg         — Connecting refraction line (middle layer)
├── particles.svg    — Twin entangled orbs (front layer)
├── preview.svg      — Visual reference of the assembled icon (dark mode)
└── README.md        — This file
```

All three layer SVGs are 1024×1024, fully opaque white-on-transparent — the format Icon Composer expects. Gradients, glass effects, and per-mode colors are applied inside Icon Composer rather than baked into the SVG.

## Assembly

1. Open Icon Composer (Xcode → Open Developer Tool → Icon Composer)
2. New Icon
3. Drag the three layer files onto the canvas in this order — back to front:
   1. `halos.svg`
   2. `wave.svg`
   3. `particles.svg`
4. Apply the settings in the next section
5. File → Save As → `Entangle.icon`
6. Drag `Entangle.icon` into your Xcode project's file navigator
7. In your target's General tab, set **App Icon** to `Entangle`

## Settings per mode

Icon Composer lets you set fill, opacity, blur, and glass properties separately for Default, Dark, and Mono. Switch modes via the toggle at the bottom of the canvas, then set the color/effect dropdown at the top of the Inspector to that same mode before changing values.

### Background

| Mode    | Fill                               |
|---------|------------------------------------|
| Default | Gradient: `#F5F7FA` → `#D4DAE6`    |
| Dark    | Gradient: `#2A2D34` → `#0E1014`    |
| Mono    | System Dark                        |

Gradient direction: vertical (top to bottom).

### Layer 1 — halos

The diffuse glow under each particle. Heavy blur, low opacity.

| Setting | Default     | Dark        | Mono     |
|---------|-------------|-------------|----------|
| Fill    | `#3A5E90`   | `#A3BBD6`   | `#FFFFFF`|
| Opacity | 8%          | 12%         | 8%       |
| Blur    | 60          | 60          | 60       |
| Glass   | Off         | Off         | Off      |

### Layer 2 — wave

The connecting refraction line. Subtle glass adds dimensionality without making it the focal point.

| Setting | Default     | Dark        | Mono     |
|---------|-------------|-------------|----------|
| Fill    | `#3A5E90`   | `#A3BBD6`   | `#FFFFFF`|
| Opacity | 55%         | 65%         | 50%      |
| Glass   | Subtle      | Subtle      | Subtle   |

> If Icon Composer doesn't render the stroked path correctly, open `wave.svg` in Sketch / Figma / Illustrator, select the path, and apply Path → Outline Stroke before re-importing. Some versions of Icon Composer prefer filled shapes over strokes.

### Layer 3 — particles

The two glass orbs — the entangled pair. This is where Liquid Glass does its work.

| Setting       | Default              | Dark                 | Mono              |
|---------------|----------------------|----------------------|-------------------|
| Fill          | Gradient (radial)*   | Gradient (radial)*   | Solid `#FFFFFF`   |
| Opacity       | 100%                 | 100%                 | 100%              |
| Glass         | Liquid Glass         | Liquid Glass         | Liquid Glass      |
| Specular      | High                 | High                 | High              |
| Translucency  | Medium               | Medium               | Low               |
| Shadow        | 8% black, soft       | 12% black, soft      | Off               |

*Radial gradient with the highlight in the upper-left (35%, 30% origin):

- **Default**: `#9BB6D6` (0%) → `#4E6E95` (50%) → `#1D2C44` (100%)
- **Dark**: `#D6E4F4` (0%) → `#7393B8` (55%) → `#2C3E58` (100%)

## Design notes

- **Asymmetric orbs**: the larger left orb (87px radius on the 1024 canvas) reads as the desktop being controlled; the smaller right (72px) is the mobile remote. The asymmetry survives at home-screen scale.
- **Two-hump wave**: a sine-like quantum wave rather than a straight tether. Suggests probability/entanglement rather than a wired connection.
- **Steel-blue palette**: pulled from your app's surface, deliberately muted to feel native rather than promotional.
- **Glass on particles only**: keeps the focal points dimensional without the wave or halos competing for attention.

## Customization

- **Warmer accent** — shift the particle gradient toward indigo: `#C7D5F5` → `#6A7FB8` → `#2A2E5A`
- **More energetic** — bump wave opacity to 80% and increase shadow on particles
- **Flatter / less premium** — disable Liquid Glass on particles, use solid fills
- **Larger orbs on home screen** — in Icon Composer, scale the particles layer up by 1.15× (Inspector → Position & Scale)

## iOS 18 and earlier

`.icon` files aren't read by iOS 18 or earlier. Two options:

1. Keep your existing `AppIcon` set in `Assets.xcassets` and name the new bundle `AppIcon.icon` matching it — Xcode picks the right one per target version.
2. Let Xcode auto-generate flattened bitmaps from the `.icon` (default behavior with "Include all app icon assets" enabled in Build Settings).
