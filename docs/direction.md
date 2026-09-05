# roboeyes-image-editor 方針

この文書は、プロジェクトの設計思想・優先順位・方向性を定義する一次資料です。実装上の判断で迷った場合は、まずこの文書に立ち返ります。

## 1. 目的

`roboeyes-image-editor` は、単なる RoboEyes のブラウザ移植ではなく、

> **RoboEyes の「目・表情をパラメータで定義し、状態をリアルタイムに生成する」という設計思想を抽象化した、汎用的なパラメトリック・フェイス / アイ・イメージエディタ**

として設計します。

最初の主用途:

- RoboEyes 系の目画像生成
- Codex Pet 用の表情素材生成
- M5Stack / 小型ディスプレイ向け画像生成
- 組込み機器向けスプライト生成
- PNG / SVG / WebP / sprite sheet 等への書き出し

将来的には RoboEyes 以外のスタイルも扱える構造にします。

## 2. 基本思想

完成画像を直接描くのではなく、顔や目を **パラメータで定義されたモデル** として扱います。

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

RoboEyes は、このエンジン上の一つのプリセット / 互換レイヤーです。

## 3. RoboEyes から継承する思想

固定画像素材を中心に据えず、目の形状や状態を変数として管理する考え方を維持します。

代表的な要素:

- width
- height
- border radius
- eye spacing
- gaze direction
- mood
- blink
- idle
- curiosity
- cyclops
- flicker

ただし、内部データモデルは RoboEyes 固有 API に依存しすぎないようにします。

## 4. 汎用内部モデル

概念例:

```ts
type Eye = {
  x: number
  y: number
  width: number
  height: number
  radius: number
  rotation: number
}

type FaceModel = {
  canvas: {
    width: number
    height: number
  }

  leftEye: Eye
  rightEye: Eye

  gaze: {
    x: number
    y: number
  }

  expression: {
    upperLid: number
    lowerLid: number
    tilt: number
  }
}
```

実装は将来以下を追加できる構造にします。

- symmetry / asymmetry
- eye spacing
- eye scale
- eyelid shape
- pupil / highlight
- transforms
- color
- stroke
- background
- animation state
- easing / spring
- timing

## 5. RoboEyes 互換レイヤー

RoboEyes のパラメータを内部モデルへ変換する adapter を持たせます。

```text
RoboEyes Parameters
        ↓
RoboEyes Adapter
        ↓
Generic Face Model
        ↓
Renderer
```

目的:

- RoboEyes API との互換性を保つ
- UI を一般化する
- RoboEyes 以外のスタイルを追加できるようにする
- renderer の差し替えを容易にする

## 6. プリセット

スタイルは固定画像ではなく、以下のようなパラメータ集合として扱います。

- initial geometry
- expression defaults
- color
- constraints
- animation defaults

想定例:

```text
Presets
├─ RoboEyes
├─ M5Stack style
├─ Vector-style
├─ Cute
├─ Minimal
└─ Custom
```

## 7. Editor UX

ブラウザ上でパラメータ変更を即座に preview へ反映します。

重要な UX:

- slider の変更を realtime 反映
- 左右対称 / 個別編集の切替
- 数値直接入力
- Undo / Redo
- Reset
- Preset 保存
- Preview 解像度切替

## 8. Rendering

初期実装は SVG を第一候補とします。

理由:

- parametric editing と相性が良い
- 拡大縮小で劣化しない
- PNG / WebP への変換が容易
- rotation / radius / transform の処理が簡単
- DOM 上で realtime 編集しやすい

```text
Face Model
    ↓
SVG Renderer
    ↓
Live Preview
    ↓
Rasterize
    ↓
PNG / WebP
```

必要になれば Canvas renderer を追加します。

## 9. 小型ディスプレイ対応

一般的なキャラクター制作ツールとの差別化として、**組込み機器・小型ディスプレイ向け出力** を重視します。

想定プリセット解像度:

- 128×64
- 128×128
- 240×240
- 320×240
- 320×320
- Custom

重点機能:

- pixel-perfect preview
- nearest-neighbor preview
- monochrome preview
- 1-bit preview
- transparent background
- fixed canvas
- safe area

## 10. Export

最終的な対象:

### Image

- PNG
- WebP
- SVG

### Animation

- animated WebP
- GIF
- sprite sheet

### Embedded

- C/C++ bitmap array
- RGB565
- monochrome bitmap
- XBM

特に M5Stack / Arduino / ESP32 でそのまま使える形式を重視します。

## 11. Animation

静止画像エディタから開始しますが、モデル自体は animation を考慮して設計します。

想定 state:

- idle
- blink
- wink
- look-left
- look-right
- look-up
- look-down
- happy
- angry
- sleep
- surprised

将来的には timeline 主体ではなく **state + transition** を中心にします。

```text
idle → blink → idle
neutral → happy
```

状態間を補間して生成できる構造を目指します。

## 12. Mote Studio との位置付け

Mote Studio は設計思想が近い参考例ですが、本プロジェクトは **組込みディスプレイ・ロボットフェイス向けのパラメトリック画像 / スプライト生成ツール** に軸足を置きます。

重点:

- RoboEyes compatibility
- small display
- pixel-perfect preview
- static image export
- sprite sheet
- embedded bitmap export

## 13. Architecture direction

```text
src/
├─ core/
│  ├─ model/
│  ├─ presets/
│  └─ adapters/
├─ renderers/
│  ├─ svg/
│  └─ canvas/
├─ animation/
├─ export/
└─ ui/
   ├─ editor/
   ├─ controls/
   └─ preview/
```

詳細は [`architecture.md`](architecture.md) を参照してください。

## 14. MVP phases

### Phase 1 — Static editor

- left / right eye
- width
- height
- radius
- spacing
- position
- gaze
- rotation
- canvas size
- realtime SVG preview
- PNG export
- SVG export

### Phase 2 — Expression

- happy
- angry
- tired
- surprised
- custom
- eyelid controls

### Phase 3 — Animation

- blink
- idle
- gaze movement
- state transitions

### Phase 4 — Embedded export

- sprite sheet
- RGB565
- monochrome bitmap
- C array

## 15. 初期開発方針

最初のゴール:

> **RoboEyes の目をブラウザ上で自由に調整し、PNG / SVG として保存できる。**

ただし、内部実装は最初から次のように分離します。

```text
RoboEyes
   ↓
adapter
   ↓
generic model
   ↓
renderer
```

MVP の実装量を抑えつつ、後から汎用エディタへ拡張できることを優先します。

## 16. Project definition

一言で表すなら、

> **RoboEyes の思想を汎用化した、組込みディスプレイ向け Parametric Robot Face Editor**

を目指します。

リポジトリ名 `roboeyes-image-editor` は現段階では維持します。将来、機能が拡大した場合はリブランドを検討できます。
