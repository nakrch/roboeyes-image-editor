# Contributing

このプロジェクトは現在 private repository として初期開発中です。この文書は、実装時に設計思想を崩さないための基本ルールを定義します。

## 1. Source of truth

設計判断の優先順位:

1. [`docs/direction.md`](docs/direction.md)
2. [`docs/architecture.md`](docs/architecture.md)
3. [`docs/roadmap.md`](docs/roadmap.md)
4. 対応 GitHub Issue
5. 実装詳細

Issue や実装都合が direction と矛盾する場合は、direction を無言で曲げず、先に設計判断を更新します。

## 2. Architectural rules

### Keep layers separated

原則:

```text
style/API parameters
      ↓
adapter
      ↓
generic model
      ↓
renderer
      ↓
preview/export
```

避けること:

- React component 内に RoboEyes 描画ロジックを直書きする
- SVG renderer が RoboEyes 固有パラメータを直接読む
- export が UI state を直接参照する
- renderer 内で random animation state を生成する

### Generic model first

新しい機能を追加するときは、まず次を判断します。

- generic face model の能力か
- RoboEyes adapter 固有の変換か
- renderer 固有表現か
- UI convenience か

## 3. MVP discipline

Phase 1 のゴールは静止画エディタです。

Phase 1 で優先:

- generic model
- RoboEyes adapter
- realtime SVG preview
- editor controls
- PNG / SVG export

後回し:

- animation timeline
- animated WebP
- sprite sheet generator
- embedded bitmap export
- broad character-authoring features

将来機能のための拡張余地は確保しますが、先回り実装は避けます。

## 4. Small-display first

UI / renderer / export の変更では以下を確認してください。

- exact canvas size が維持されるか
- small resolution で扱えるか
- transparent background を壊さないか
- pixel-perfect / nearest-neighbor preview の追加を妨げないか
- embedded export のために model が過度に renderer 依存になっていないか

## 5. Code organization

想定責務:

```text
src/core/model/        domain model
src/core/adapters/     style/API compatibility mapping
src/core/presets/      parameter presets
src/renderers/         model → visual representation
src/ui/                editor interaction/view
src/animation/         state/transition/easing
src/export/            image/embedded export
```

## 6. Testing expectations

最低限、次を優先して test します。

- adapter conversion
- model invariants / normalization
- renderer determinism
- exact output dimensions
- preset serialization
- export correctness

UI の細部より、domain と renderer の再現性を先に保証します。

## 7. Pull request / commit scope

変更は可能な限り Issue 単位に分割します。

良い例:

- generic FaceModel だけを追加
- SVG renderer だけを追加
- PNG export だけを追加

避ける例:

- model + animation + export + UI redesign を一度に変更

## 8. External projects and licensing

RoboEyes や類似プロジェクトの思想・API・実装を参考にする場合は、採用前にライセンスと attribution 要件を確認します。

特定実装のソースコードをコピーする場合は、互換性・再配布条件・NOTICE 等を確認してから行います。設計思想を参考にして独自実装する場合も、README / docs に必要な出典を残します。

## 9. Definition of done

各 Issue は、少なくとも以下を満たして完了とします。

- acceptance criteria を満たす
- build/test が通る
- layer boundary を壊していない
- 必要な docs を更新する
- Phase scope を不必要に広げていない
