# RoboEyes Image Editor

> 🚧 **Under active development**
>
> **Phase 1–3 are complete.** The current baseline includes static editing, parametric expressions, deterministic animation authoring/playback, and static/animated image export.

**RoboEyes Image Editor** is a browser-based parametric editor for creating robot eye and face graphics for small displays.

Instead of editing fixed images, eye shape, spacing, gaze, expression, canvas size, animation state, and other properties are represented as parameters and rendered dynamically.

このプロジェクトは RoboEyes の単純なブラウザ移植ではありません。目・表情・視線・状態を固定画像ではなく **パラメータで定義されたモデル** として扱い、RoboEyes はその上に載る互換レイヤー / プリセットの一つとして扱います。

## Live editor

The current editor is published with GitHub Pages:

https://nakrch.github.io/roboeyes-image-editor/

The site is rebuilt and redeployed automatically whenever changes are pushed or merged to `main`. Deployment status and failures are visible in GitHub Actions under the **Deploy GitHub Pages** workflow.

## Current capabilities

### Static editing

- realtime SVG preview
- independent / linked left and right eye editing
- RoboEyes-compatible parameters through an adapter layer
- eye geometry, spacing, gaze, rotation, canvas, color, and background controls
- preset save/load and JSON import/export
- SVG and PNG export
- exact small-display resolution presets
- single-eye / RoboEyes cyclops-compatible layout

### Expressions

- generic eyelid/mask authoring
- RoboEyes-compatible core expressions
- gaze-reactive Curious behavior
- reusable expression-only presets
- asymmetric/custom expression parameters
- deterministic visual-regression coverage

### Animation

- deterministic explicit-time animation runtime
- state transitions and spring transitions
- blink / wink / open / close / sleep
- deterministic auto-blink and idle gaze
- motion primitives including Confused / Laugh style one-shots
- composable temporal behavior profiles
- transient effects
- reusable ordered state programs with hold/transition timing
- once / loop / ping-pong playback
- persistent animation defaults in preset JSON
- browser preview/player with reduced-motion handling
- deterministic temporal regression and frame-rate-independence tests

### Animated export

- deterministic frame sampling
- animated WebP export
- GIF export

## Project status

Phase 1 established the static parametric editor and PNG/SVG workflow. Its completion audit is recorded in [Issue #78](https://github.com/nakrch/roboeyes-image-editor/issues/78).

Phase 2 completed the parametric expression system and static regression coverage. The completed tracker is [Issue #86](https://github.com/nakrch/roboeyes-image-editor/issues/86).

Phase 3 completed the deterministic animation runtime, behavior system, authoring/player workflow, persistence, regression coverage, transient effects, spring transitions, and animated image export. The completed tracker is [Issue #97](https://github.com/nakrch/roboeyes-image-editor/issues/97).

Future changes are tracked as ordinary Issues rather than being assigned to another numbered development phase.

## Core concept

```text
Eye / Face Geometry
        ↓
Expression
        ↓
Pose / Gaze
        ↓
Animation
        ↓
Renderer
        ↓
Export
```

RoboEyes-compatible input follows this boundary:

```text
RoboEyes Parameters
        ↓
RoboEyes Adapter
        ↓
Generic Face Model
        ↓
Renderer
```

This separation keeps RoboEyes compatibility while allowing other parameterized styles and presets to be added without coupling the renderer to one source library.

## Primary use cases

- RoboEyes-style eye/face asset authoring
- Codex Pet expression and animation assets
- fixed-size / small-display graphics
- PNG / SVG static assets
- animated WebP / GIF assets

## Design principles

- edit a **parametric model**, not fixed source images
- keep UI, model, adapter, renderer, animation, and export responsibilities separated
- keep the renderer deterministic and free of timers/randomness
- treat exact canvas dimensions and small-display workflows as first-class requirements
- model animation as **state + transition** and reusable ordered state programs rather than a free-form video/keyframe timeline
- preserve static assets as valid inputs independent of animation runtime state

## Small-display focus

Preset resolutions include:

- 128×64
- 128×128
- 240×240
- 320×240
- 320×320
- Custom

The editor prioritizes exact canvas dimensions, transparent backgrounds, predictable rasterization, and deterministic output at these sizes.

## Stack

- React
- TypeScript
- Vite
- SVG-first renderer

## Documentation

Start with [`docs/README.md`](docs/README.md).

- [`docs/direction.md`](docs/direction.md) — project direction and scope
- [`docs/architecture.md`](docs/architecture.md) — layer responsibilities and data flow
- [`docs/roadmap.md`](docs/roadmap.md) — completed Phase 0–3 history and future candidates
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contribution and PR workflow
- [`AGENTS.md`](AGENTS.md) — repository-specific guidance for coding agents

## Acknowledgements

This project is inspired by [FluxGarage RoboEyes](https://github.com/FluxGarage/RoboEyes), created by Dennis Hoelscher / FluxGarage and licensed under GPL-3.0-or-later.

`roboeyes-image-editor` is an independent implementation and is not an official FluxGarage project. RoboEyes compatibility and design concepts are implemented through a separate adapter/model architecture rather than by treating the original library as the renderer itself.

## License

`roboeyes-image-editor` is licensed under **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. See [`LICENSE`](LICENSE).
