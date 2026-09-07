# Roadmap

このロードマップは [`direction.md`](direction.md) の Phase 1〜4 を実装順に落としたものです。

## Phase 0 — Foundation

目的: 実装前に責務境界と開発基盤を固定する。

- React + TypeScript + Vite
- generic model / adapter / renderer のディレクトリ分離
- README / direction / architecture / contributing の整備
- 基本 lint / test / build 導線

対応 Issue:

- #1 Bootstrap React/Vite/TypeScript project and base architecture

## Phase 1 — Static RoboEyes-style editor

**Status: Complete. Formal completion audit: #78.**

ゴール:

> **RoboEyes の目をブラウザ上で自由に調整し、PNG / SVG として保存できる。**

### 1.1 Generic model + RoboEyes adapter

- left / right eye geometry
- width / height
- radius
- spacing
- position
- gaze
- rotation
- canvas
- color / background の拡張余地
- RoboEyes-compatible parameters → generic model

対応 Issue:

- #2 Define generic FaceModel and RoboEyes adapter

### 1.2 SVG renderer + preview

- realtime SVG rendering
- exact canvas size
- transparent background
- deterministic output
- standalone SVG serialization

対応 Issue:

- #3 Implement SVG renderer and realtime preview

### 1.3 Editor UI

- sliders
- direct numeric input
- symmetric / independent eye editing
- Reset
- Undo / Redo
- preview resolution presets

想定解像度:

- 128×64
- 128×128
- 240×240
- 320×240
- 320×320
- Custom

対応 Issue:

- #4 Build realtime parameter editor UI

### 1.4 Presets

- RoboEyes
- Minimal
- custom preset save/load
- JSON import/export

対応 Issue:

- #5 Add preset system and RoboEyes-compatible defaults

### 1.5 Static export

- SVG
- PNG
- transparent / opaque background
- exact configured dimensions

対応 Issue:

- #6 Implement PNG and SVG export for static assets

### Phase 1 completion criteria

- browser だけで静止画を調整できる
- RoboEyes 固有入力が renderer に直接依存していない
- generic model から SVG preview を生成できる
- PNG / SVG として保存できる
- small-display resolution を正確に扱える

これらの完了条件は Issue #78 で監査済み。

## Phase 2 — Expressions

**Status: Complete. Tracker: [#86](https://github.com/nakrch/roboeyes-image-editor/issues/86).**

目的: 表情を固定画像ではなく model parameters で表現する。

対象:

- happy
- angry
- tired
- surprised
- custom / asymmetric expressions
- generic upper/lower/directional eyelid controls
- gaze-reactive Curious deformation
- reusable expression-only presets
- deterministic visual-regression coverage

初期実装の #7 に加え、Phase 2 の残作業は #86 で分割・監査し、完了済み。詳細な実装履歴と完了条件は [Phase 2 tracker #86](https://github.com/nakrch/roboeyes-image-editor/issues/86) を source of truth とする。

## Phase 3 — Animation

**Status: Active / in progress. Parent tracker: [#97](https://github.com/nakrch/roboeyes-image-editor/issues/97).**

目的: 完成済みの静的 `FaceModel` / Expression を入力として、明示的な時間と seed から同じフレームを再現できる deterministic animation layer を構築する。

中心となる考え方は **state + transition** であり、free-form な video/keyframe timeline editor を先に作る方針ではない。単一状態の遷移だけでなく、`idle → blink → idle` や `neutral → happy → neutral` のような **再利用可能な ordered state program** を、hold/transition timing と playback mode を持つ plain data として扱う。

```text
static FaceModel / Expression
        ↓
serializable animation definition / state program
        + explicit runtime trigger events
        ↓
deterministic evaluator(time, seed, events)
        ↓
resolved frame state
        ↓
renderer
```

### Core Phase 3 issues — blocking

実装順・依存関係の source of truth は [#97](https://github.com/nakrch/roboeyes-image-editor/issues/97)。コア完了に必要な child issues:

- [#98](https://github.com/nakrch/roboeyes-image-editor/issues/98) — deterministic evaluator / clock / seeded scheduler / runtime events
- [#99](https://github.com/nakrch/roboeyes-image-editor/issues/99) — generic state transitions / FaceModel interpolation
- [#100](https://github.com/nakrch/roboeyes-image-editor/issues/100) — blink / wink / open / close / sleep
- [#101](https://github.com/nakrch/roboeyes-image-editor/issues/101) — deterministic auto-blink
- [#102](https://github.com/nakrch/roboeyes-image-editor/issues/102) — deterministic idle gaze / bounded wander
- [#103](https://github.com/nakrch/roboeyes-image-editor/issues/103) — motion primitives / Confused / Laugh
- [#104](https://github.com/nakrch/roboeyes-image-editor/issues/104) — composable temporal behavior profiles
- [#112](https://github.com/nakrch/roboeyes-image-editor/issues/112) — reusable state-sequence animation programs / playback modes
- [#105](https://github.com/nakrch/roboeyes-image-editor/issues/105) — serializable animation definitions / preset integration
- [#107](https://github.com/nakrch/roboeyes-image-editor/issues/107) — animation preview player / authoring controls
- [#108](https://github.com/nakrch/roboeyes-image-editor/issues/108) — temporal regression / frame-rate-independence tests

### Phase 3 follow-ups — non-blocking

以下は Phase 3 の参照互換・出力・高度な motion refinement として追跡するが、core Phase 3 closure の必須条件ではない。

- [#106](https://github.com/nakrch/roboeyes-image-editor/issues/106) — generic transient effect layer / animated sweat
- [#109](https://github.com/nakrch/roboeyes-image-editor/issues/109) — animated WebP / GIF export from deterministic frame sampling
- [#113](https://github.com/nakrch/roboeyes-image-editor/issues/113) — deterministic spring transition profiles / spring authoring

### Phase 3 / Phase 4 export boundary

Phase 3 では deterministic frame sampling を確立し、その follow-up として animated WebP / GIF を扱う。**sprite sheet と embedded-oriented binary formats は Phase 4** に残し、Phase 3 の animation runtime / editor scope と混在させない。

## Phase 4 — Embedded export

目的: 小型ディスプレイ・組込み機器へ直接持ち込める出力を提供する。

対象:

- sprite sheet
- RGB565
- monochrome bitmap
- 1-bit bitmap
- XBM
- C/C++ array

想定ターゲット:

- M5Stack
- Arduino
- ESP32
- その他 fixed-size display

## Future candidates

方向性と整合する場合のみ検討する。

- WebP static export
- pixel-perfect / nearest-neighbor inspection tools
- safe area overlays
- additional adapters/styles
- M5Stack-style / Cute / Vector-style presets
- pupil / highlight
- reusable preset packages
- RoboEyes cyclops-compatible single-eye layout — static-layout backlog [#110](https://github.com/nakrch/roboeyes-image-editor/issues/110), not a Phase 3 blocker

Spring/easing authoring is already tracked as the non-blocking Phase 3 motion follow-up [#113](https://github.com/nakrch/roboeyes-image-editor/issues/113).

## Prioritization rule

機能追加の優先順位は次の順で判断する。

1. parametric model の一貫性
2. RoboEyes compatibility
3. small-display usability
4. static asset generation
5. state-based animation
6. embedded export
7. generic character-authoring features

一般的なキャラクター制作ツールへ広げることより、まず **Parametric Robot Face Editor** としての強みを維持する。
