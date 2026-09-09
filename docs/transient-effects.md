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

The first overlay primitive is a renderer-independent rounded rectangle:

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

The SVG renderer only understands this generic primitive. It contains no `sweat` mood/behavior branch, timer, or random reset logic.

Future temporary effects can add reusable overlay primitives or effect definitions without adding fields to the static face model.

## Sweat reference mapping

FluxGarage/RoboEyes V1.1.1 draws three animated sweat drops in the upper display area:

- left, center, and right horizontal regions
- Y advances by `0.5` per reference render update
- the drop grows during the first portion of the fall and shrinks afterward
- after reaching its sampled target Y, X and target Y are randomized for the next drop
- the rounded shape uses radius `3`

This project preserves that behavioral intent but removes render-count dependence:

- the established reference cadence is treated as 50 Hz (`20 ms` per update)
- `0.5 / 20 ms = 0.025` canvas units per millisecond is the default fall speed
- X position and target Y are sampled from named deterministic random streams
- each drop/cycle is addressed by explicit drop/cycle indices
- the same `FaceModel + definition + timeMs + seed + events` resolves to the same overlay frame regardless of prior browser frames

For the reference-compatible three-drop default on canvases at least 60 units wide, horizontal regions are:

```text
left:   0 .. 30
center: 30 .. width - 30
right:  width - 30 .. width
```

Other droplet counts or narrow canvases use equal horizontal bands.

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
- the static Export panel continues to export the authored base face; animated output is tracked separately by #109

## Reduced motion

As with other ambient automatic preview motion, `prefers-reduced-motion: reduce` suppresses authored Sweat motion in the live preview without altering serialized definitions.

Explicit transient runtime events remain usable, matching the Phase 3 rule that direct controls stay available even when ambient motion is suppressed.
