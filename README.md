# RoboEyes Image Editor

**RoboEyes の思想を汎用化した、組込みディスプレイ向け Parametric Robot Face Editor** を目指すブラウザアプリです。

このプロジェクトは RoboEyes の単純なブラウザ移植ではありません。目・表情・視線・状態を固定画像ではなく **パラメータで定義されたモデル** として扱い、RoboEyes はその上に載る互換レイヤー / プリセットの一つとして扱います。

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

## MVP

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

## Status

初期設計・基礎ドキュメント整備中です。実装は GitHub Issues に沿って段階的に進めます。
