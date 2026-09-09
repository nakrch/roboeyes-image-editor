# Roadmap

この文書は `roboeyes-image-editor` の完了済み開発フェーズと、今後検討できる改善候補をまとめます。

設計思想の一次資料は [`direction.md`](direction.md)、詳細仕様の索引は [`README.md`](README.md) を参照してください。

## Phase 0 — Foundation — Complete

目的: 実装前に責務境界と開発基盤を固定する。

- React + TypeScript + Vite
- generic model / adapter / renderer の責務分離
- README / direction / architecture / contributing の整備
- lint / test / build / GitHub Pages / PR Preview の開発導線

対応 Issue:

- #1 Bootstrap React/Vite/TypeScript project and base architecture

## Phase 1 — Static RoboEyes-style editor — Complete

完了監査: [#78](https://github.com/nakrch/roboeyes-image-editor/issues/78)

ゴール:

> **RoboEyes の目をブラウザ上で自由に調整し、PNG / SVG として保存できる。**

完了範囲:

- generic `FaceModel`
- RoboEyes adapter
- left / right eye geometry
- width / height / radius / spacing / position / gaze / rotation
- exact canvas size
- linked / independent eye editing
- realtime SVG preview
- Undo / Redo / Reset
- face presets / JSON import-export
- SVG / PNG export
- small-display resolution presets

## Phase 2 — Expressions — Complete

Tracker: [#86](https://github.com/nakrch/roboeyes-image-editor/issues/86)

目的: 表情を固定画像ではなく generic model parameters で表現する。

完了範囲:

- generic upper/lower/directional eyelid controls
- RoboEyes-compatible Happy / Angry / Tired
- Surprised / Curious / custom / asymmetric expressions
- gaze-reactive Curious deformation
- reusable expression-only presets
- additional static expression presets
- deterministic Visual Regression Gallery

## Phase 3 — Animation — Complete

Parent tracker: [#97](https://github.com/nakrch/roboeyes-image-editor/issues/97)

目的: 完成済みの静的 `FaceModel` / Expression を入力として、明示的な time・seed・runtime events から同じ frame を再現できる deterministic animation layer を構築する。

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

中心は **state + transition** と再利用可能な ordered state program であり、free-form video/keyframe timeline editor ではない。

### Completed core work

- [#98](https://github.com/nakrch/roboeyes-image-editor/issues/98) — deterministic evaluator / clock / seeded scheduler / runtime events
- [#99](https://github.com/nakrch/roboeyes-image-editor/issues/99) — generic state transitions / FaceModel interpolation
- [#100](https://github.com/nakrch/roboeyes-image-editor/issues/100) — blink / wink / open / close / sleep
- [#101](https://github.com/nakrch/roboeyes-image-editor/issues/101) — deterministic auto-blink
- [#102](https://github.com/nakrch/roboeyes-image-editor/issues/102) — deterministic idle gaze / bounded wander
- [#103](https://github.com/nakrch/roboeyes-image-editor/issues/103) — motion primitives / Confused / Laugh
- [#104](https://github.com/nakrch/roboeyes-image-editor/issues/104) — composable temporal behavior profiles
- [#112](https://github.com/nakrch/roboeyes-image-editor/issues/112) — reusable state-sequence programs / playback modes
- [#105](https://github.com/nakrch/roboeyes-image-editor/issues/105) — serializable animation definitions / preset integration
- [#107](https://github.com/nakrch/roboeyes-image-editor/issues/107) — animation preview player / authoring controls
- [#108](https://github.com/nakrch/roboeyes-image-editor/issues/108) — temporal regression / frame-rate-independence tests

### Completed extensions

- [#106](https://github.com/nakrch/roboeyes-image-editor/issues/106) — transient effect layer / deterministic animated sweat
- [#109](https://github.com/nakrch/roboeyes-image-editor/issues/109) — animated WebP / GIF export from deterministic frame sampling
- [#113](https://github.com/nakrch/roboeyes-image-editor/issues/113) — deterministic spring transition profiles / authoring
- [#110](https://github.com/nakrch/roboeyes-image-editor/issues/110) — generic single-eye / RoboEyes cyclops layout compatibility

## Current baseline

Phase 1–3 の完了後、プロジェクトの基準機能は次の通りです。

- parametric static eye/face editing
- generic expression authoring
- RoboEyes compatibility through adapters
- deterministic state/transition animation
- behavior/profile/sequence authoring
- static PNG/SVG export
- animated WebP/GIF export
- deterministic static/temporal regression

今後の変更は、この baseline を壊さない個別 Issue として管理します。

## Future candidates

方向性と整合し、実際の利用価値が確認できるものだけを追加します。

- static WebP export
- pixel-perfect / nearest-neighbor inspection tools
- safe-area overlays
- additional adapters/styles
- additional face/expression/behavior preset packages
- pupil / highlight support
- editor UX / accessibility refinements
- import/export workflow improvements
- runtime/API ergonomics and performance improvements

## Prioritization rule

機能追加の優先順位は次の順で判断します。

1. parametric model の一貫性
2. RoboEyes compatibility
3. deterministic rendering / animation
4. editor usability
5. small-display usability
6. static / animated asset workflow
7. generic character-authoring features

一般的な動画・キャラクター制作ツールへ広げることより、まず **Parametric Robot Face Editor** としての強みを維持します。
