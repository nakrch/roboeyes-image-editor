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
7. 最新 PR head の自動 PR Preview が完了したら、**生成された Preview URL を merge 前にユーザーとのチャットへ直接提示する**
8. **URL提示時に、そのPRが「ユーザー確認が必要な変更」か「内部変更」かを必ず明記する**
9. UI/UX、操作、renderer、preview、animationの見た目/挙動、export出力など、Previewで意味のある確認ができる **ユーザー向け変更** では、その場で停止し、次のユーザーメッセージで `OK` / `問題ない` / `mergeして` 等の明示的なmerge承認を得る
10. docs-only、test、CI/config、pure refactor、runtime/core内部変更など、Preview上の見た目に意味のある差分がない **内部変更** では、その旨を明記する。URL提示とCI/Preview成功後は、別の承認メッセージを待たずmergeしてよい
11. merge により対象 Issue を close する

内部変更なのに単に「Previewは同じです」とだけ書くのではなく、**「これは内部変更です。Preview上の見た目差分はありません」** と分類まで伝えます。

原則として「先に PR を作り、後から Issue を作る」運用は避けます。

例外として、明白な typo 修正や挙動・設計に影響しないごく小さなドキュメント修正は Issue なしでも構いません。

## 8. PR Preview before merge

実装 PR では、**PR Preview URL のユーザーへの直接提示と、変更種別の明示**を merge 前の handoff gate とします。GitHub上のBotコメントだけで済ませず、現在のユーザーとのチャットに、すぐ開ける形でPreview URLを表示します。

### ユーザー向け変更

対象例:

- UI layout / style
- slider、pointer、touch、keyboard などの interaction
- editor の操作感や入力感度
- renderer / preview の見た目
- animation の見た目や時間挙動
- export 結果など、ユーザーが直接確認できる出力

この場合は、Preview URLを提示した応答ではmergeしません。そこで停止し、ユーザーがPreviewを確認した後の新しいメッセージで明示的なmerge承認を得ます。

### 内部変更

対象例:

- docs-only
- test
- CI/config
- pure refactor
- runtime/core内部ロジックで、Preview上の見た目に意味のある差分がないもの

この場合もPreview URLはmerge前にチャットへ提示しますが、**同時に「内部変更であり、Preview上の見た目差分はない」ことを明示**します。CIとPreviewが成功していれば、別のユーザー承認メッセージを待たずmergeして構いません。

merge 前に確認すること:

- PR Preview workflow が成功している
- Preview が最新 PR head から生成されている
- Preview URL が開ける
- **Preview URL をユーザーとのチャットへ提示済み**
- **そのPRがユーザー向け変更か内部変更かを明示済み**
- ユーザー向け変更では、URL提示後に明示的なmerge承認を得ている
- 視覚・操作感が関係する場合は、実機または適切なブラウザで手動確認済み
- test/build/CI も成功している

PR Preview が failed / cancelled / stale / unavailable の状態では、ユーザー向け変更を merge しません。Preview は CI の代替ではなく、CI + Preview を merge gate とします。

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
- 実装 PR では、最新 PR Preview URL を merge 前にユーザーとのチャットへ提示している
- **ユーザー向け変更か内部変更かを明示している**
- ユーザー向け変更では、Preview URL提示後にユーザーから明示的なmerge承認を得ている
- 内部変更では、Preview上の見た目差分がないことを明記している
- ユーザー向け変更では、最新 PR Preview が成功し、必要な実機・目視確認が完了している
