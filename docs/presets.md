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
