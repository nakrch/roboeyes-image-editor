# Preset system

Presets are parameter/model defaults, not fixed images.

The editor always applies a preset by replacing the current generic `FaceModel`. Rendering continues through the normal model → renderer flow.

## Schema

`FacePreset` is defined in `src/core/presets/schema.ts` and contains:

- `id` / `name` / schema `version`
- `model` — generic `FaceModel` defaults, including geometry, expression and colors
- `constraints` — optional numeric editing constraints keyed by generic property path
- `animationDefaults` — reserved data for future state/transition defaults
- `preview` — optional editor preview defaults such as transparent background

## Built-in presets

### RoboEyes

`roboEyesPreset` is created from `defaultRoboEyesPreset` through `roboEyesToFaceModel()`.

This preserves the required compatibility boundary:

```text
RoboEyes parameters → adapter → generic FaceModel → renderer
```

### Minimal

`minimalPreset` defines a generic `FaceModel` directly. It intentionally does not use RoboEyes parameters and demonstrates that the editor is not coupled to RoboEyes.

## Expression presets

Expression presets are reusable generic `ExpressionModel` values. They do not introduce mood-specific renderer branches: applying one only changes expression state and then uses the normal `FaceModel → renderer` flow.

The original [FluxGarage/RoboEyes](https://github.com/FluxGarage/RoboEyes) implementation is the compatibility reference for the core vocabulary. Its `TIRED` and `ANGRY` expressions are background-colored triangular upper masks, while `HAPPY` uses a rounded lower mask. Those drawing primitives are translated into the generic directional-lid and lower-lid parameters rather than copied as RoboEyes-specific renderer flags.

### Derivative-inspired static pack

Phase 2 also includes a small static vocabulary inspired by derivative projects:

- [mchobby/micropython-roboeyes](https://github.com/mchobby/micropython-roboeyes) adds `FROZEN`, `SCARY`, and `CURIOUS`. Its `FROZEN` expression is primarily horizontal flicker and its `SCARY` expression combines a tired-style shape with vertical flicker, so their time-based behavior is intentionally **not** represented as new Phase 2 static presets. `CURIOUS` is represented separately through generic gaze-reactive height parameters.
- [winsonwq/robo-eyes](https://github.com/winsonwq/robo-eyes) demonstrates a broader static vocabulary including `SAD`, `SUSPICIOUS`, `SERIOUS`, and `IRRITATED`. The editor borrows those visual ideas but translates them into the existing generic expression model rather than copying its mood switch, shape enum, color effects, or animation effects.

The selected static presets are:

- **Sad** — modest outer-directed upper masks, positive mirrored tilt, slight lower curvature, and reduced height.
- **Suspicious** — explicit per-eye overrides create an asymmetric squint without a renderer special case.
- **Serious** — symmetric upper/lower narrowing with a modest height reduction.
- **Irritated** — a milder inner-directed upper mask than Angry, combined with a small opposite tilt and reduced height.

All four are deterministic at a fixed `FaceModel` and remain renderer-independent. Flicker, shake, timed blink, restless gaze, bounce, and other temporal effects remain Phase 3 state/animation concerns.

## Adding another built-in style

1. Create a file under `src/core/presets/`, for example `cute.ts`.
2. Export a `FacePreset` containing a generic `FaceModel` plus constraints/default metadata.
3. If the source style has its own parameter vocabulary, create an adapter under `src/core/adapters/` and build the preset model through that adapter.
4. Add the preset to `builtInPresets` in `src/core/presets/index.ts`.
5. Add tests showing the preset produces the expected generic model.

Do not make the SVG renderer aware of a style or preset name.

## Custom presets

The editor can capture the current model as a custom preset. Custom presets are stored in browser `localStorage` using the versioned key `roboeyes-image-editor.custom-presets.v1`.

Presets can also be exported and imported as JSON. Imported JSON is validated against the supported schema before it is added to local presets.
