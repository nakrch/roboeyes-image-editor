# Architecture

この文書は `roboeyes-image-editor` の現在のアーキテクチャと各レイヤーの責務を定義します。

設計思想の一次資料は [`direction.md`](direction.md) です。詳細な機能仕様は [`README.md`](README.md) から参照してください。

## 1. Core rule

最重要ルールは、RoboEyes 固有の概念を renderer や generic model に直接埋め込まないことです。

```text
RoboEyes / style parameters
        ↓
adapter
        ↓
generic FaceModel + generic animation data
        ↓
deterministic evaluator / renderer
        ↓
preview / export
```

UI は RoboEyes 互換項目を表示できますが、描画・animation・export は generic data を経由します。

## 2. Layer responsibilities

### `core/model`

renderer・UI・RoboEyes API に依存しない domain model を定義します。

責務:

- canvas
- left/right eye geometry
- eye visibility / single-eye layout
- position / size / radius / rotation
- gaze
- expression / eyelid geometry
- colors / stroke / background
- serializable plain data invariants

禁止:

- React 型への依存
- SVG DOM への依存
- RoboEyes 固有メソッド名への依存
- runtime timer/random state の保持

### `core/adapters`

外部 API や特定スタイルの語彙を generic model / generic parameters に変換します。

代表例:

- RoboEyes geometry / gaze vocabulary
- RoboEyes cyclops compatibility

adapter は互換性の境界であり、renderer に RoboEyes 固有フラグを流しません。

### `core/presets`

再利用可能な authoring data を扱います。

- face preset
- expression preset
- animation defaults
- deterministic seed

Preset JSON は runtime playback state を保存しません。

### `renderers/svg`

`FaceModel` と renderer-independent overlay data を SVG に変換します。

責務:

- deterministic rendering
- exact canvas size
- transparent / opaque background
- geometry / expression / transform rendering
- standalone SVG serialization
- transient overlay primitive rendering

禁止:

- timer / wall clock / randomness
- animation scheduling
- RoboEyes-specific behavior branches
- editor state の保持

### `animation`

静的 `FaceModel` を explicit logical time と seed から resolved frame に変換します。

主な責務:

- playback clock helpers
- deterministic random substreams / schedulers
- state transitions / easing / spring
- eye openness / blink / auto-blink
- idle gaze
- motion offsets / one-shots
- behavior profiles
- ordered state programs
- transient-effect frame resolution
- versioned animation authoring data

中心契約:

```text
base FaceModel
+ AnimationDefinition / AnimationProgram
+ RuntimeAnimationEvent[]
+ explicit timeMs
+ seed
        ↓
evaluate
        ↓
resolved FaceModel + optional overlays
```

同じ入力からは、sampling order や browser frame cadence に依存せず同じ結果を得ます。

### `ui`

ユーザー操作、authoring state、preview runtime state を仲介します。

責務:

- model / preset / animation authoring controls
- Undo / Redo / Reset
- realtime static preview
- animation play / pause / stop / restart / speed
- manual runtime triggers
- reduced-motion preview policy
- import/export orchestration

Authoring state と resolved preview state を分離し、再生 frame ごとに Undo/Redo history を増やしません。

### `export`

renderer / deterministic frame sampler の結果をファイルへ変換します。

現在の出力:

- SVG
- PNG
- animated WebP
- GIF

Static export は authored base model を、animated export は explicit timestamp で deterministic runtime を sampling した frame sequence を使用します。

## 3. Directory structure

概念上の責務は次の構造に対応します。

```text
src/
├─ core/
│  ├─ model/
│  ├─ adapters/
│  └─ presets/
├─ renderers/
│  └─ svg/
├─ animation/
├─ export/
└─ ui/
```

実ファイル構成は必要に応じて変化して構いません。重要なのはディレクトリ名そのものではなく責務境界です。

## 4. Data flow

### RoboEyes-compatible static editing

```text
UI RoboEyes controls
        ↓
RoboEyes parameter state
        ↓
RoboEyes adapter
        ↓
FaceModel
        ↓
SVG renderer
        ↓
Live preview / static export
```

### Generic editing

```text
Generic UI controls
        ↓
FaceModel
        ↓
SVG renderer
        ↓
Live preview / static export
```

### Animation preview

```text
Authored FaceModel + animation defaults
        + runtime events
        + logical time / seed
        ↓
Animation evaluator
        ↓
Resolved FaceModel + overlays
        ↓
SVG renderer
        ↓
Preview
```

### Animated export

```text
Authored model + animation data
        ↓
deterministic timestamp schedule
        ↓
resolved frames
        ↓
SVG render + rasterize
        ↓
GIF / animated WebP encoder
```

Realtime `requestAnimationFrame` cadence is not an export input.

## 5. Single-eye / RoboEyes cyclops compatibility

RoboEyes の `cyclops` は adapter 入力に限定し、generic model / renderer に同名の behavior branch を持ち込みません。

```text
RoboEyes cyclops
        ↓
Adapter
        ↓
FaceModel.eyeVisibility + centered generic layout
        ↓
visibility-aware model / animation
        ↓
renderer / preview / export
```

Hidden eye geometry は破壊せず保持し、two-eye layout へ戻せるようにします。

## 6. State ownership

状態を次の3種類に分けます。

- **domain/authoring state** — serializable `FaceModel`, preset, animation definition/program
- **editor/view state** — selected panel, zoom, active controls, history
- **runtime preview state** — playback position/status, current manual events, browser timing input

Runtime preview state を preset JSON や renderer に持ち込みません。

## 7. Determinism

### Renderer

同じ `FaceModel` / overlay input に対して同じ visual output を返します。

### Animation

randomness は seed + named stream + event index から決定し、`Math.random()` や sampling order に依存しません。

### Export

animated export は explicit timestamp schedule を使用し、monitor refresh rate や dropped preview frames に依存しません。

## 8. Small-display requirements

小型ディスプレイ対応は後付けではなく設計要件です。

- exact fixed canvas
- common fixed-size presets
- transparent background
- deterministic geometry
- predictable rasterization
- pixel-perfect / nearest-neighbor inspection を追加しやすい構造

## 9. Extensibility rules

新機能を追加する際は以下を確認します。

1. RoboEyes/style 固有機能か generic face 機能か
2. model / adapter / animation / renderer / UI のどこが責務を持つべきか
3. renderer 固有の都合が domain model に漏れていないか
4. runtime state が persisted authoring data に混ざっていないか
5. randomness / time が deterministic contract を壊していないか
6. static editing/export を animation が壊していないか
7. small-display workflow を不必要に複雑化していないか

## 10. Current scope boundary

現在のプロジェクトは **Parametric Robot Face Editor** です。

中心スコープ:

- parametric eye/face geometry
- expression authoring
- RoboEyes compatibility
- deterministic state-based animation
- reusable behavior/program authoring
- static/animated image asset export

free-form video/keyframe timeline、3D rig、汎用 character studio へ広げることは現在の中心スコープではありません。
