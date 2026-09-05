# Architecture

この文書は `roboeyes-image-editor` の初期アーキテクチャと各レイヤーの責務を定義します。

設計思想の一次資料は [`direction.md`](direction.md) です。実装上の詳細はこの文書で具体化します。

## 1. Core rule

最重要ルールは、RoboEyes 固有の概念を renderer や UI に直接埋め込まないことです。

```text
RoboEyes Parameters
        ↓
RoboEyes Adapter
        ↓
Generic Face Model
        ↓
Renderer
        ↓
Preview / Export
```

UI は必要に応じて RoboEyes 互換項目を表示できますが、描画は必ず generic model を経由します。

## 2. Layer responsibilities

### `core/model`

renderer・UI・RoboEyes API に依存しない内部表現を定義します。

責務:

- canvas
- left/right eye geometry
- position
- size
- radius
- rotation
- gaze
- expression / eyelid
- colors / stroke / background
- 将来の animation state へ拡張できる型

禁止:

- React 型への依存
- SVG DOM への依存
- RoboEyes 固有メソッド名への依存

### `core/adapters`

外部または特定スタイルのパラメータを generic model に変換します。

初期対象:

- RoboEyes adapter

将来は別スタイル adapter を追加できます。

### `core/presets`

固定画像ではなく、初期パラメータ・constraint・expression default・color・将来の animation default の集合を扱います。

### `renderers/svg`

`FaceModel` を SVG に変換します。

責務:

- model を deterministic に描画
- canvas size を厳密に尊重
- transparent background
- rotation / radius / transform
- standalone SVG への serializable な出力

禁止:

- RoboEyes adapter の呼び出し
- editor state の保持

### `renderers/canvas`

初期 MVP では実装必須ではありません。SVG では不足する要件が出た場合に追加します。

### `ui`

ユーザー操作を generic model / preset / adapter に反映し preview を表示します。

想定構成:

- `ui/editor/` — editor state orchestration
- `ui/controls/` — slider / numeric / color / toggle
- `ui/preview/` — live preview

### `animation`

Phase 3 以降で使用します。

timeline 主体ではなく **state + transition** を基本とします。

```text
state
  + transition
  + easing/timing
  → interpolated FaceModel
```

### `export`

renderer / model の結果を各出力形式へ変換します。

初期:

- SVG
- PNG

将来:

- WebP
- animated WebP
- GIF
- sprite sheet
- RGB565
- monochrome bitmap
- XBM
- C/C++ array

## 3. Initial directory structure

```text
src/
├─ core/
│  ├─ model/
│  │  ├─ face.ts
│  │  ├─ eye.ts
│  │  └─ expression.ts
│  ├─ presets/
│  │  ├─ roboeyes.ts
│  │  └─ minimal.ts
│  └─ adapters/
│     └─ roboeyes.ts
├─ renderers/
│  ├─ svg/
│  └─ canvas/
├─ animation/
│  ├─ states.ts
│  ├─ transition.ts
│  └─ easing.ts
├─ export/
│  ├─ png.ts
│  ├─ webp.ts
│  ├─ svg.ts
│  ├─ spritesheet.ts
│  └─ embedded.ts
└─ ui/
   ├─ editor/
   ├─ controls/
   └─ preview/
```

未実装の将来レイヤーは、MVP 時点で空ディレクトリを無理に作る必要はありません。責務境界だけを維持します。

## 4. Data flow

### RoboEyes-compatible editing

```text
UI RoboEyes controls
        ↓
RoboEyes parameter state
        ↓
RoboEyes Adapter
        ↓
FaceModel
        ↓
SVG Renderer
        ↓
Live Preview
```

### Generic editing

```text
Generic UI controls
        ↓
FaceModel
        ↓
SVG Renderer
        ↓
Live Preview
```

### Static export

```text
FaceModel
   ↓
SVG Renderer
   ├─→ SVG export
   └─→ rasterize → PNG export
```

## 5. State ownership

MVP では editor state を React 側に置いて構いませんが、domain model 自体は React 非依存にします。

推奨分離:

- `domain/model`: serializable plain data
- `editor state`: current values, history, active preset
- `view state`: zoom, preview mode, panel open/close

Undo / Redo は model/editor state の履歴を対象とし、renderer 内では管理しません。

## 6. Small-display requirements

小型ディスプレイ対応は後付けではなく、設計要件です。

renderer / preview / export は以下を阻害しないようにします。

- exact fixed canvas
- pixel-perfect preview
- nearest-neighbor preview
- monochrome / 1-bit preview
- transparent background
- safe area
- embedded formats

## 7. Determinism

同じ `FaceModel` 入力に対して renderer は同じ出力を返すことを原則とします。

random idle や flicker のような挙動は model/animation レイヤーで seed または明示状態として扱い、renderer に randomness を持ち込みません。

## 8. Extensibility rules

新機能を追加する際は以下を確認します。

1. RoboEyes 固有機能か generic face 機能か
2. model に表現すべきか adapter で吸収すべきか
3. renderer 固有の都合が model に漏れていないか
4. small-display / export workflow を壊していないか
5. animation を追加する場合、固定フレーム列ではなく state/transition で表現できないか

## 9. MVP boundary

Phase 1 では次だけを完成させます。

- generic face model
- RoboEyes adapter
- SVG renderer
- realtime editor UI
- PNG / SVG static export

animation、sprite sheet、embedded export は設計上の拡張余地を確保しますが、Phase 1 の実装必須範囲には含めません。
