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

## Phase 2 — Expressions

目的: 表情を固定画像ではなく model parameters で表現する。

対象:

- happy
- angry
- tired
- surprised
- custom
- upper/lower eyelid controls
- left/right asymmetry

対応 Issue:

- #7 Add expression model and eyelid controls

Phase 2 の追加 Issue は実装知見に合わせて分割する。

## Phase 3 — Animation

目的: 静止モデルから状態遷移ベースの animation を生成する。

対象 state:

- blink
- wink
- idle
- look-left / right / up / down
- sleep
- expression transitions

設計原則:

```text
state + transition + easing/timing
            ↓
      interpolated model
            ↓
         renderer
```

主な出力候補:

- animated WebP
- GIF
- sprite sheet

この Phase では timeline editor を先に作らず、state/transition workflow を優先する。

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
- spring/easing editor
- reusable preset packages

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
