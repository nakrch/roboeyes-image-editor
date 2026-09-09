# Contributing

このプロジェクトは、設計思想を保ちながら Issue 単位で段階的に開発するオープンソースプロジェクトです。この文書は、実装・レビュー・コントリビューション時に設計方針を崩さないための基本ルールを定義します。

Phase 1–3 は完了済みです。今後の変更は、完成済みの static model / expression / deterministic animation / static・animated image export を baseline として扱います。

## 1. Source of truth

設計判断の優先順位:

1. [`docs/direction.md`](docs/direction.md)
2. [`docs/architecture.md`](docs/architecture.md)
3. [`docs/roadmap.md`](docs/roadmap.md)
4. [`docs/README.md`](docs/README.md) から参照する機能別仕様書
5. 対応 GitHub Issue
6. 実装詳細

Issue や実装都合が direction と矛盾する場合は、direction を無言で曲げず、先に設計判断を更新します。

## 2. Architectural rules

### Keep layers separated

原則:

```text
style/API parameters
      ↓
adapter
      ↓
generic model + generic animation data
      ↓
deterministic evaluator / renderer
      ↓
preview/export
```

避けること:

- React component 内に RoboEyes 描画ロジックを直書きする
- SVG renderer が RoboEyes 固有パラメータを直接読む
- renderer 内で timer / random animation state を生成する
- animation semantics を browser frame cadence に依存させる
- export が UI の一時 runtime state を直接参照する
- runtime playback state を preset JSON に永続化する

### Generic model first

新しい機能を追加するときは、まず次を判断します。

- generic face model の能力か
- RoboEyes/style adapter 固有の変換か
- animation runtime / behavior の責務か
- renderer 固有表現か
- UI convenience か
- export encoder / serialization の責務か

## 3. Current scope discipline

このプロジェクトの中心は **Parametric Robot Face Editor** です。

現在の baseline:

- static eye/face authoring
- generic expression authoring
- RoboEyes compatibility
- deterministic state-based animation
- behavior profile / ordered state program authoring
- SVG / PNG export
- animated WebP / GIF export

free-form video/keyframe timeline、3D rig、汎用 character studio へ無計画に拡張しないでください。方向性を変える必要がある場合は、先に `docs/direction.md` を更新する設計判断を行います。

## 4. Small-display first

UI / renderer / animation / export の変更では以下を確認してください。

- exact canvas size が維持されるか
- small resolution で扱えるか
- transparent background を壊さないか
- geometry / timing が deterministic か
- predictable rasterization を壊していないか
- pixel-perfect / nearest-neighbor inspection workflow の追加を妨げないか

## 5. Code organization

責務の目安:

```text
src/core/model/        domain model
src/core/adapters/     style/API compatibility mapping
src/core/presets/      parameter presets / persisted defaults
src/renderers/         model → visual representation
src/animation/         explicit-time deterministic animation
src/export/            static / animated image export
src/ui/                editor interaction / view / playback orchestration
```

ディレクトリ構造そのものより、責務境界を優先します。

## 6. Testing expectations

変更内容に応じて、少なくとも次を優先します。

- adapter conversion
- model invariants / normalization
- renderer determinism
- exact output dimensions
- preset / animation serialization
- explicit-time animation determinism
- frame-rate / seek independence
- export correctness
- static regression compatibility

UI の細部だけでなく、domain・renderer・animation runtime の再現性を保証します。

## 7. Issue-first workflow

バグ、改善、挙動変更、新機能は **Issue-first** で管理します。

原則フロー:

1. バグ・改善案・仕様変更を見つける
2. 実装前に GitHub Issue を作成、または既存 Issue を特定する
3. 必要に応じて再現手順、現状、期待動作、acceptance criteria を記録する
4. その Issue を解決する実装 PR を作る
5. PR 本文から `Fixes #123` / `Closes #123` 等で Issue を紐付ける
6. test/build/CI を通す
7. 最新 PR head の自動 PR Preview が完了したら、生成された Preview URL を merge 前にユーザーとのチャットへ直接提示する
8. URL提示時に、そのPRが **ユーザー向け変更** か **内部変更** かを必ず明記する
9. ユーザー向け変更では、その場で停止し、次のユーザーメッセージで明示的な merge 承認を得る
10. 内部変更では、Preview上の見た目に意味のある差分がない旨を明記する。CI/Preview 成功後は別の承認を待たず merge してよい
11. merge により対象 Issue を close する

明白な typo 修正や挙動・設計に影響しないごく小さな docs-only 修正は Issue なしでも構いません。

## 8. PR Preview before merge

実装 PR では、**PR Preview URL のユーザーへの直接提示と、変更種別の明示**を merge 前の handoff gate とします。

### ユーザー向け変更

対象例:

- UI layout / style
- slider、pointer、touch、keyboard 等の interaction
- renderer / preview の見た目
- animation の見た目や時間挙動
- export 結果など、ユーザーが直接確認できる出力

この場合は Preview URL を提示した応答では merge しません。ユーザーが確認した後の新しいメッセージで明示的な承認を得ます。

### 内部変更

対象例:

- docs-only
- test
- CI/config
- pure refactor
- runtime/core 内部変更で、Preview上の見た目に意味のある差分がないもの

この場合も Preview URL は merge 前に提示し、**内部変更であり Preview 上の見た目差分はない**ことを明示します。CI と Preview が成功していれば、別の承認メッセージを待たず merge して構いません。

merge 前に確認すること:

- PR Preview workflow が成功している
- Preview が最新 PR head から生成されている
- Preview URL が開ける
- Preview URL をユーザーとのチャットへ提示済み
- PR がユーザー向け変更か内部変更かを明示済み
- ユーザー向け変更では URL 提示後に明示的な merge 承認を得ている
- 視覚・操作感が関係する場合は適切なブラウザ / 実機で手動確認済み
- test/build/CI も成功している

PR Preview が failed / cancelled / stale / unavailable の状態では、ユーザー向け変更を merge しません。Preview は CI の代替ではありません。

## 9. Pull request / commit scope

変更は可能な限り Issue 単位に分割します。

良い例:

- generic model の変更と対応 test
- animation behavior 1種類と temporal regression
- export format の修正と encoder test
- UI interaction の修正と必要な model/runtime change

避ける例:

- model + unrelated animation + export + UI redesign を一度に変更

## 10. External projects and licensing

RoboEyes や類似プロジェクトの思想・API・実装を参考にする場合は、採用前にライセンスと attribution 要件を確認します。

特定実装のソースコードをコピーする場合は、互換性・再配布条件・NOTICE 等を確認してから行います。設計思想を参考にして独自実装する場合も、README / docs に必要な出典を残します。

## 11. Definition of done

各 Issue は、少なくとも以下を満たして完了とします。

- acceptance criteria を満たす
- build/test が通る
- layer boundary を壊していない
- deterministic contract を壊していない
- 必要な docs を更新する
- project scope を不必要に広げていない
- 実装 PR では最新 PR Preview URL を merge 前にユーザーとのチャットへ提示している
- ユーザー向け変更か内部変更かを明示している
- ユーザー向け変更では Preview URL 提示後に明示的な merge 承認を得ている
- 内部変更では Preview 上の見た目差分がないことを明記している
