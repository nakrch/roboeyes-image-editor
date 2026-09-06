# Contributing

このプロジェクトは、設計思想を保ちながら Issue 単位で段階的に開発するオープンソースプロジェクトです。この文書は、実装・レビュー・コントリビューション時に設計方針を崩さないための基本ルールを定義します。

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

## 7. Issue-first workflow

バグ、改善、挙動変更、新機能は **Issue-first** で管理します。

原則フロー:

1. バグ・改善案・仕様変更を見つける
2. 実装を始める前に GitHub Issue を作成、または既存 Issue を特定する
3. Issue に必要に応じて再現手順、現状、期待動作、acceptance criteria を記録する
4. その Issue を解決するための実装 PR を作る
5. PR 本文から `Fixes #123` / `Closes #123` 等で Issue を紐付ける
6. test/build/CI を通す
7. ユーザーに見える変更は、最新 PR head の自動 PR Preview を開き、実機・目視で確認する
8. CI と必要な Preview 確認の両方が完了してから merge する
9. merge により対象 Issue を close する

原則として「先に PR を作り、後から Issue を作る」運用は避けます。

例外として、明白な typo 修正や挙動・設計に影響しないごく小さなドキュメント修正は Issue なしでも構いません。

## 8. PR Preview before merge

ユーザーが見たり触ったりする変更では、**PR Preview を merge 前の必須検証にします**。

対象例:

- UI layout / style
- slider、pointer、touch、keyboard などの interaction
- editor の操作感や入力感度
- renderer / preview の見た目
- export 結果など、ユーザーが直接確認できる出力

merge 前に確認すること:

- PR Preview workflow が成功している
- Preview が最新 PR head から生成されている
- Preview URL が開ける
- 視覚・操作感が関係する場合は、実機または適切なブラウザで手動確認済み
- test/build/CI も成功している

PR Preview が failed / cancelled / stale / unavailable の状態では、ユーザー向け変更を merge しません。Preview は CI の代替ではなく、**CI + Preview の両方**を merge gate とします。

docs-only、コメントのみ、pure refactor など、Preview を開いても意味のある追加検証にならない変更は手動 Preview 確認を省略できます。ただし通常の CI は必要です。

## 9. Pull request / commit scope

変更は可能な限り Issue 単位に分割します。

良い例:

- generic FaceModel だけを追加
- SVG renderer だけを追加
- PNG export だけを追加

避ける例:

- model + animation + export + UI redesign を一度に変更

## 10. External projects and licensing

RoboEyes や類似プロジェクトの思想・API・実装を参考にする場合は、採用前にライセンスと attribution 要件を確認します。

特定実装のソースコードをコピーする場合は、互換性・再配布条件・NOTICE 等を確認してから行います。設計思想を参考にして独自実装する場合も、README / docs に必要な出典を残します。

## 11. Definition of done

各 Issue は、少なくとも以下を満たして完了とします。

- acceptance criteria を満たす
- build/test が通る
- layer boundary を壊していない
- 必要な docs を更新する
- Phase scope を不必要に広げていない
- ユーザー向け変更では、最新 PR Preview が成功し、必要な実機・目視確認が完了している
