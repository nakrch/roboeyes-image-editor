# roboeyes-image-editor 方針

この文書は、プロジェクトの設計思想・優先順位・スコープを定義する一次資料です。実装上の判断で迷った場合は、まずこの文書に立ち返ります。

## 1. 目的

`roboeyes-image-editor` は、単なる RoboEyes のブラウザ移植ではなく、

> **RoboEyes の「目・表情・動きをパラメータで定義し、状態をリアルタイムに生成する」という設計思想を抽象化した、汎用的なパラメトリック・フェイス / アイ・エディタ**

として設計します。

主用途:

- RoboEyes 系の目画像・アニメーション生成
- Codex Pet 用の表情 / animation asset 生成
- 固定解像度・小型ディスプレイ向け画像生成
- PNG / SVG / animated WebP / GIF への書き出し

将来的に RoboEyes 以外のスタイルも扱える構造を維持します。

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

RoboEyes は、このエンジン上の一つの互換レイヤー / preset です。

## 3. RoboEyes から継承する思想

固定画像素材を中心に据えず、目の形状や状態を変数として管理する考え方を維持します。

代表的な要素:

- width / height / radius
- eye spacing / position
- gaze direction
- mood / expression
- blink / wink / sleep
- idle / curiosity
- cyclops
- flicker / shake

ただし、内部データモデルは RoboEyes 固有 API に依存しすぎないようにします。

## 4. 汎用内部モデル

中心となる domain model は renderer / React / RoboEyes API から独立した plain data とします。

概念:

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
  canvas: { width: number; height: number }
  leftEye: Eye
  rightEye: Eye
  gaze: { x: number; y: number }
  expression: ExpressionModel
}
```

実装では左右非対称 expression、eye visibility、color/background なども generic model として扱います。

## 5. RoboEyes 互換レイヤー

RoboEyes のパラメータや語彙は adapter で generic model / generic behavior に変換します。

```text
RoboEyes Parameters
        ↓
RoboEyes Adapter
        ↓
Generic Face Model / Animation Definition
        ↓
Renderer
```

目的:

- RoboEyes の見た目・挙動との互換性を保つ
- UI と renderer を一般化する
- RoboEyes 固有フラグを renderer に漏らさない
- 他スタイルを追加できる構造を維持する

## 6. Preset

Preset は固定画像ではなく、再利用可能な authoring data として扱います。

対象:

- face geometry / canvas / color
- expression
- animation defaults
- deterministic seed
- behavior profile
- ordered state program

静的 preset と animation runtime state は分離します。再生位置や一時 trigger は永続化しません。

## 7. Editor UX

ブラウザ上で確定した authoring state の変更を即座に preview へ反映します。

重要な UX:

- slider / keyboard / touch slider は有効な値を realtime に反映する
- direct numeric input は編集中の文字列を一時 draft として保持し、空欄・符号入力途中・小数入力途中を model へ早期反映しない
- direct numeric input は Enter または blur で確定し、その時点で validation / clamp / precision normalization を適用して preview へ反映する
- linked / independent eye editing
- `Position X / Y` は UI 上では canvas 中心を `0, 0` とする相対座標で扱い、generic model の内部絶対座標とは UI boundary で変換する
- Controls の先頭に `Display` を置き、resolution / canvas size / transparent background / Pixel perfect preview をまとめる
- Undo / Redo / Reset
- face / expression preset
- animation play / pause / stop / restart
- manual blink/wink/motion trigger
- behavior / sequence authoring
- reduced-motion を尊重した preview
- Apply / Delete の完了や export/download の browser handoff は共通 toast で即時 feedback を出し、ブラウザ管理 download を「保存完了」とは表現しない

再生中に解決された frame は一時的な preview state であり、authoring model や Undo/Redo history を frame ごとに書き換えません。

## 8. Rendering

SVG renderer を中心にします。

```text
Face Model
    ↓
SVG Renderer
    ↓
Live Preview
    ↓
Rasterize when needed
    ↓
PNG / animated image export
```

renderer は deterministic で、timer・wall clock・randomness を持ちません。animation/effect layer が explicit time と seed から resolved frame を生成して renderer に渡します。

## 9. Small-display focus

一般的なキャラクター制作ツールとの差別化として、**固定サイズ・小型ディスプレイで扱いやすい画像生成**を first-class に扱います。

想定プリセット解像度:

- 128×64
- 128×128
- 240×240
- 320×240
- 320×320
- Custom

重点:

- exact fixed canvas
- transparent background
- deterministic output
- predictable rasterization
- basic Pixel perfect preview と、将来の nearest-neighbor / safe-area inspection workflow に拡張しやすい構造

## 10. Export

現在の主要出力:

### Static

- SVG
- PNG

### Animation

- animated WebP
- GIF

Animation export は realtime preview の frame cadence を録画するのではなく、deterministic runtime を explicit timestamp で sampling して生成します。

## 11. Animation

Animation は **state + transition** を中心にします。free-form video/keyframe timeline をプロジェクトの中心にはしません。

```text
static FaceModel / Expression
        +
serializable animation definition / ordered state program
        +
explicit runtime events
        +
time / seed
        ↓
deterministic evaluator
        ↓
resolved frame state
        ↓
renderer
```

対象には以下を含みます。

- state / expression / gaze transitions
- easing / spring
- blink / wink / open / close / sleep
- auto-blink
- idle gaze
- flicker / shiver / Confused / Laugh style motion
- composable behavior profiles
- transient effects
- ordered programs with hold/transition timing
- once / loop / ping-pong playback

同じ authoring data、runtime events、time、seed からは同じ frame が得られることを原則とします。

## 12. Mote Studio との位置付け

Mote Studio は animation document / state-program workflow の参考例ですが、本プロジェクトは **RoboEyes compatibility と小型表示向け parametric eye/face authoring** に軸足を置きます。

汎用的な動画編集、3D rig、音声 timeline などへ広げることは優先しません。

## 13. Architecture direction

```text
src/
├─ core/          # model / adapters / presets
├─ renderers/     # deterministic visual rendering
├─ animation/     # time/seed/event based frame resolution
├─ export/        # static and animated image export
└─ ui/            # editor / controls / preview
```

詳細は [`architecture.md`](architecture.md) を参照してください。

## 14. Completed development phases

### Phase 1 — Static editor

Static FaceModel、RoboEyes adapter、realtime SVG preview、PNG/SVG export を完成。

### Phase 2 — Expressions

Generic eyelid/mask expression、RoboEyes-compatible expressions、Curious、expression preset、visual regression を完成。

### Phase 3 — Animation

Deterministic runtime、state/spring transitions、blink/idle/motion、behavior profiles、state programs、persistence、browser player、temporal regression、transient effects、animated WebP/GIF export を完成。

今後の改善は必要に応じて個別 Issue として扱い、新しい Phase 番号を前提にしません。

## 15. Project definition

一言で表すなら、

> **RoboEyes の思想を汎用化した、small-display oriented Parametric Robot Face Editor**

です。

リポジトリ名 `roboeyes-image-editor` は維持します。機能が大きく拡張された場合のみ、必要性を確認してリブランドを検討します。
