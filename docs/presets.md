# Preset system

Presets are parameter/model authoring defaults, not fixed images.

The editor applies a face preset by replacing the authored generic `FaceModel` and initializing its persisted animation defaults. Rendering continues through the normal model → animation resolution (when active) → renderer flow.

## Schema

`FacePreset` is defined in `src/core/presets/schema.ts` and contains:

- `id` / `name` / schema `version`
- `model` — generic `FaceModel` defaults, including geometry, expression and colors
- `constraints` — optional numeric editing constraints keyed by generic property path
- `animationDefaults` — versioned deterministic animation authoring data; `{}` remains valid for static-only presets
- `preview` — optional editor preview defaults such as transparent background

`animationDefaults` may contain authored seed, generic channel definitions, a behavior profile, and an ordered animation program. Playback position, playing/paused state, runtime trigger events, and random cursors are runtime-only and are not persisted. See [`animation-persistence.md`](animation-persistence.md).

## Built-in face presets

### RoboEyes

`roboEyesPreset` is created from `defaultRoboEyesPreset` through `roboEyesToFaceModel()`.

This preserves the required compatibility boundary:

```text
RoboEyes parameters → adapter → generic FaceModel → renderer
```

### Minimal

`minimalPreset` defines a generic `FaceModel` directly. It intentionally does not use RoboEyes parameters and demonstrates that the editor is not coupled to RoboEyes.

## Expression presets

Expression presets are reusable generic `ExpressionModel` values. They do not introduce mood-specific renderer branches: applying one changes authored expression state and then uses the normal generic rendering flow.

The original [FluxGarage/RoboEyes](https://github.com/FluxGarage/RoboEyes) implementation is the compatibility reference for the core vocabulary. Its `TIRED` and `ANGRY` expressions are background-colored triangular upper masks, while `HAPPY` uses a rounded lower mask. Those drawing primitives are translated into the generic directional-lid and lower-lid parameters rather than copied as RoboEyes-specific renderer flags.

### Derivative-inspired static pack

The static vocabulary also includes visual ideas inspired by derivative projects:

- [mchobby/micropython-roboeyes](https://github.com/mchobby/micropython-roboeyes) adds `FROZEN`, `SCARY`, and `CURIOUS`. Time-based behavior such as flicker is represented by the generic animation layer rather than being baked into static expression presets. `CURIOUS` uses generic gaze-reactive height parameters.
- [winsonwq/robo-eyes](https://github.com/winsonwq/robo-eyes) demonstrates a broader static vocabulary including `SAD`, `SUSPICIOUS`, `SERIOUS`, and `IRRITATED`. The editor borrows those visual ideas but translates them into the existing generic expression model rather than copying mood switches, shape enums, color effects, or animation effects.

The selected static presets are:

- **Sad** — modest outer-directed upper masks, positive mirrored tilt, slight lower curvature, and reduced height.
- **Suspicious** — explicit per-eye overrides create an asymmetric squint without a renderer special case.
- **Serious** — symmetric upper/lower narrowing with a modest height reduction.
- **Irritated** — a milder inner-directed upper mask than Angry, combined with a small opposite tilt and reduced height.

All are deterministic at a fixed `FaceModel` and remain renderer-independent. Temporal effects such as flicker, shake, blink scheduling, idle gaze, and bounce are composed separately by the animation system.

## Animation presets and defaults

Animation authoring stays separate from static expression identity.

- behavior profiles compose reusable temporal defaults without mutating the underlying expression
- ordered state programs persist stable program/step/action identities
- a persisted seed provides reproducible random behavior
- runtime manual triggers remain ephemeral

Applying a static-only preset with `animationDefaults: {}` preserves static behavior exactly.

## Adding another built-in style

1. Create a file under `src/core/presets/`, for example `cute.ts`.
2. Export a `FacePreset` containing a generic `FaceModel` plus constraints/default metadata.
3. If the source style has its own parameter vocabulary, create an adapter under `src/core/adapters/` and build the preset model through that adapter.
4. Add the preset to `builtInPresets` in `src/core/presets/index.ts`.
5. Add tests showing the preset produces the expected generic model.

Do not make the SVG renderer aware of a style or preset name.

## Custom presets

The editor can capture the current authored model and supported animation defaults as a custom preset. Custom presets are stored in browser `localStorage` using the versioned application storage format.

Presets can also be exported and imported as JSON. Imported JSON is validated against the supported schema before it is added to local presets; invalid runtime-only or unsupported fields are rejected or skipped according to the owning validator contract.
