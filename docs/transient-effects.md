# Transient effects

Issue #106 adds a renderer-independent transient visual-effect boundary on top of the deterministic Phase 3 face runtime.

## Data flow

```text
static FaceModel
  + state / gaze / eye / motion animation
        ↓
resolved FaceModel
        +
transient-effect definition + seed + time + runtime events
        ↓
TransientEffectFrame { overlays[] }
        ↓
renderer
```

Transient effects are deliberately **not** stored in `ExpressionModel` or eye geometry. The resolved face and the temporary visual overlays remain separate values through preview/rendering.

## Generic overlay contract

The renderer currently supports two renderer-independent transient overlay primitives.

Rounded rectangle:

```ts
{
  id: string
  kind: 'rounded-rect'
  x: number
  y: number
  width: number
  height: number
  radius: number
  paint: { role: 'eye' | 'stroke' | 'background' } | { value: string }
  opacity?: number
}
```

Teardrop:

```ts
{
  id: string
  kind: 'teardrop'
  x: number
  y: number
  width: number
  height: number
  roundness: number // 0..1
  paint: { role: 'eye' | 'stroke' | 'background' } | { value: string }
  opacity?: number
}
```

The SVG renderer understands only these generic overlay primitives. It contains no `sweat` mood/behavior branch, timer, or random reset logic. Sweat is resolved into ordinary `teardrop` overlays before rendering.

Future temporary effects can reuse these primitives or add additional generic overlay kinds without adding fields to the static face model.

## Sweat reference mapping

FluxGarage/RoboEyes V1.1.1 draws three animated sweat drops in the upper display area:

- left, center, and right horizontal regions
- Y advances by `0.5` per reference render update
- the drop grows during the first portion of the fall and shrinks afterward
- after reaching its sampled target Y, X and target Y are randomized for the next drop
- the rounded/drop shape uses radius `3` as its reference shape control

This project preserves that behavioral intent but removes render-count dependence:

- the established reference cadence is treated as 50 Hz (`20 ms` per update)
- `0.5 / 20 ms = 0.025` canvas units per millisecond is the core reference/default fall speed
- X position and target Y are sampled from named deterministic random streams
- each drop/cycle is addressed by explicit drop/cycle indices
- the same `FaceModel + definition + timeMs + seed + events` resolves to the same overlay frame regardless of prior browser frames

For the three-drop layout, the reference 128-wide split points are scaled proportionally to the current canvas width:

```text
edge = width * (30 / 128)

left:   0 .. edge
center: edge .. width - edge
right:  width - edge .. width
```

Other droplet counts use equal horizontal bands.

The core transient-effect definition retains `0.025` as the RoboEyes-reference fall speed. The editor-facing evaluation path deliberately maps an omitted/reference `0.025` Sweat speed to `0.008` for the editor preview and the current animated-export frame resolver, so the authored default is less visually aggressive in the browser workflow. An explicitly authored non-reference `fallSpeed` is preserved. This editor adjustment is temporary resolved behavior and does not rewrite the persisted definition.

## Persistence

The persisted animation channel is versioned through the existing animation envelope:

```json
{
  "version": 1,
  "enabled": true,
  "channels": {
    "transient-effect": {
      "kind": "transient-effect-layer",
      "effects": [
        {
          "kind": "sweat",
          "id": "sweat",
          "enabled": true,
          "dropCount": 3
        }
      ]
    }
  }
}
```

Normalization expands omitted Sweat fields to deterministic defaults. Unknown transient-effect kinds and unknown fields are rejected rather than silently persisted.

Runtime-only playback state, drop cursors, and random cursors are never persisted.

## Editor semantics

The Animation panel exposes **Transient effects → Animated sweat** and droplet count.

- enabling/disabling the authored effect participates in editor Undo/Redo like other animation authoring data
- playback/resolved overlay frames do not create history entries
- disabling Sweat removes the authored transient-effect channel when no effect remains
- no overlays means `renderFaceToSvg(model, { overlays: [] })` remains byte-identical to ordinary static rendering
- static SVG/PNG export continues to render the authored base face without transient overlays
- animated WebP/GIF export samples resolved animation frames and transient overlays through the deterministic animation export resolver

## Reduced motion

As with other ambient automatic preview motion, `prefers-reduced-motion: reduce` suppresses authored Sweat motion in the live preview without altering serialized definitions.

Explicit transient runtime events remain usable, matching the Phase 3 rule that direct controls stay available even when ambient motion is suppressed.
