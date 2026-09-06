# RoboEyes Image Editor

> 🚧 **Under active development**
>
> **Phase 1 is complete. Phase 2 expression work is in progress.** Animation and embedded-display export remain planned for later phases.

**RoboEyes Image Editor** is a browser-based parametric editor for creating robot eye and face graphics for small displays.

Instead of editing fixed images, eye shape, spacing, gaze, expression, canvas size, and other properties are represented as parameters and rendered dynamically.

このプロジェクトは RoboEyes の単純なブラウザ移植ではありません。目・表情・視線・状態を固定画像ではなく **パラメータで定義されたモデル** として扱い、RoboEyes はその上に載る互換レイヤー / プリセットの一つとして扱います。

## Live editor

The current editor is published with GitHub Pages:

https://nakrch.github.io/roboeyes-image-editor/

The site is rebuilt and redeployed automatically whenever changes are pushed or merged to `main`. Deployment status and failures are visible in GitHub Actions under the **Deploy GitHub Pages** workflow.

## Planned Features

- realtime preview
- independent left / right eye editing
- RoboEyes-compatible parameters through an adapter layer
- eye geometry, spacing, gaze, rotation, and canvas controls
- SVG export
- PNG export
- small-display resolution presets
- transparent and pixel-perfect preview workflows
- expression presets and custom expression parameters
- future animation and embedded-display export support

## Current Status

**Phase 1 is complete and Phase 2 is in progress.**

The browser editor now supports the Phase 1 static-image workflow: generic eye geometry and gaze editing, linked/independent eye controls, realtime SVG preview, presets, small-display resolutions, and PNG/SVG export. The implementation keeps the generic model, RoboEyes adapter, renderer, UI, and export layers separated.

Phase 2 extends the same parametric model with expressions and eyelid controls. Animation and embedded-display export remain later-phase work.

Implementation progresses incrementally through GitHub Issues so that the generic model, RoboEyes adapter, renderer, editor UI, and export layers remain separated from the beginning.

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

RoboEyes 互換入力は次のレイヤーを通します。

```text
RoboEyes Parameters
        ↓
RoboEyes Adapter
        ↓
Generic Face Model
        ↓
Renderer
```

この分離により、RoboEyes 互換性を保ちながら、将来は Minimal / Cute / M5Stack-style / Vector-style / Custom など別スタイルへ拡張できます。

## Primary use cases

- RoboEyes 系の目画像生成
- Codex Pet 用の表情素材生成
- M5Stack / 小型ディスプレイ向け画像生成
- 組込み機器向けスプライト生成
- PNG / SVG / WebP / sprite sheet などへの書き出し
- 将来的な RGB565 / monochrome bitmap / C array など組込み向け出力

## Design principles

- 完成画像ではなく **parametric model** を編集する
- UI・モデル・adapter・renderer・export を分離する
- 初期 renderer は SVG を採用する
- 小型ディスプレイ用途を first-class に扱う
- animation は最終的に timeline 主体ではなく **state + transition** を中心にする
- MVP は静止画エディタから始め、将来の animation / embedded export を阻害しない構造にする

## Phase 1 MVP — Complete

Phase 1 のゴールは次です。

> **RoboEyes の目をブラウザ上で自由に調整し、PNG / SVG として保存できる。**

対象機能:

- left / right eye
- width / height
- radius
- spacing
- position
- gaze
- rotation
- canvas size
- realtime SVG preview
- PNG export
- SVG export

Phase 1 の完了監査は Issue #78 で記録しています。

MVP でも内部実装は最初から `RoboEyes → adapter → generic model → renderer` に分離します。

## Small-display focus

想定プリセット解像度:

- 128×64
- 128×128
- 240×240
- 320×240
- 320×320
- Custom

将来的に以下を重視します。

- pixel-perfect preview
- nearest-neighbor preview
- monochrome / 1-bit preview
- transparent background
- fixed canvas
- safe area

## Planned stack

- React
- TypeScript
- Vite
- SVG-first renderer

必要になった段階で Canvas renderer を追加します。

## Documentation

- [`docs/direction.md`](docs/direction.md) — プロジェクトの思想・方向性。設計判断の一次資料
- [`docs/architecture.md`](docs/architecture.md) — レイヤー構造と責務
- [`docs/roadmap.md`](docs/roadmap.md) — Phase 1〜4 の実装範囲
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — 開発時の基本ルール

## Acknowledgements

This project is inspired by [FluxGarage RoboEyes](https://github.com/FluxGarage/RoboEyes), created by Dennis Hoelscher / FluxGarage and licensed under GPL-3.0-or-later.

`roboeyes-image-editor` is an independent implementation and is not an official FluxGarage project. RoboEyes compatibility and design concepts are implemented through a separate adapter/model architecture rather than by treating the original library as the renderer itself.

## License

`roboeyes-image-editor` is licensed under **GNU General Public License v3.0 or later (GPL-3.0-or-later)**. See [`LICENSE`](LICENSE).
