# Documentation

`roboeyes-image-editor` のドキュメント索引です。

上位文書は「現在の設計・方針」を、機能別文書は「各サブシステムの詳細仕様」を説明します。過去の実装順や Issue の経緯より、現在のコードとこの索引の分類を優先して参照してください。

## Start here

1. [`direction.md`](direction.md) — プロジェクトの目的、設計思想、スコープ
2. [`architecture.md`](architecture.md) — レイヤー構造、責務、データフロー
3. [`roadmap.md`](roadmap.md) — 完了済み Phase 0–3 と今後の候補
4. [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — 開発・レビュー・PR のルール

## Static model and authoring

- [`presets.md`](presets.md) — face / expression preset と永続化
- [`visual-regression.md`](visual-regression.md) — 静的 Visual Regression Gallery の方針

## Animation runtime

- [`animation-runtime.md`](animation-runtime.md) — deterministic runtime、clock、event、random stream
- [`state-transitions.md`](state-transitions.md) — FaceModel transition と easing
- [`spring-transitions.md`](spring-transitions.md) — deterministic spring transition
- [`eye-openness.md`](eye-openness.md) — blink / wink / open / close / sleep
- [`auto-blink.md`](auto-blink.md) — deterministic auto-blink scheduler
- [`idle-gaze.md`](idle-gaze.md) — deterministic idle gaze / wander
- [`motion-offset.md`](motion-offset.md) — flicker / shiver / Confused / Laugh
- [`behavior-profiles.md`](behavior-profiles.md) — composable temporal behavior profiles
- [`transient-effects.md`](transient-effects.md) — transient overlay/effect layer

## Animation authoring and persistence

- [`animation-programs.md`](animation-programs.md) — ordered state programs、hold/transition、playback mode
- [`animation-persistence.md`](animation-persistence.md) — preset JSON と animation defaults
- [`animation-editor.md`](animation-editor.md) — editor/player、runtime state、reduced motion

## Regression policy

- [`temporal-regression.md`](temporal-regression.md) — fixed-time / seeded / cadence-independent regression
- [`visual-regression.md`](visual-regression.md) — static geometry / SVG regression

## Documentation rules

- 上位文書に「現在のプロジェクト状態」を集約し、個別仕様書にロードマップの進捗管理を持ち込まない。
- Issue 番号は実装履歴・設計根拠として残してよいが、仕様の source of truth は現行コードと対応ドキュメントとする。
- Phase 1–3 は完了済み。今後の改善は必要に応じて個別 Issue として扱い、新しい Phase 番号を前提にしない。
