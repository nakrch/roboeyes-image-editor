# AGENTS.md

## Project intent

`roboeyes-image-editor` is a **Parametric Robot Face Editor for embedded/small displays**. It generalizes the design philosophy of RoboEyes rather than implementing a browser-only clone.

Read these before making architectural changes:

1. `docs/direction.md`
2. `docs/architecture.md`
3. `docs/roadmap.md`
4. the active GitHub Issue

## Non-negotiable architecture

```text
RoboEyes/style parameters
        ↓
adapter
        ↓
generic FaceModel
        ↓
renderer
        ↓
preview/export
```

Do not let RoboEyes-specific APIs leak into the generic model, SVG renderer, or export layer.

## MVP priority

Phase 1 is a static editor:

- generic left/right eye model
- RoboEyes adapter
- realtime SVG preview
- geometry/gaze/rotation controls
- PNG export
- SVG export

Do not expand Phase 1 into animation timelines, sprite-sheet authoring, or embedded export unless the issue explicitly asks for it.

## Small-display requirements

Treat these as first-class future requirements:

- exact/fixed canvas dimensions
- 128x64, 128x128, 240x240, 320x240, 320x320, custom
- pixel-perfect / nearest-neighbor preview
- monochrome / 1-bit preview
- transparent background
- safe area
- RGB565 / bitmap / C array export

Avoid architectural choices that make these difficult later.

## Renderer rule

The renderer should be deterministic: the same `FaceModel` must produce the same visual output.

Random behaviors such as idle/flicker belong in animation/state logic, not inside the renderer.

## Animation direction

When animation work begins, prefer:

```text
state + transition + easing/timing → interpolated FaceModel → renderer
```

over a timeline-first design.

## Development discipline

- Work issue-by-issue.
- **Use an Issue-first workflow for bugs, improvements, behavior changes, and feature work.** Create or identify the GitHub Issue before starting the implementation PR.
- Record the reproduction/need, expected behavior, and acceptance criteria in the Issue when applicable.
- Create the implementation PR from that Issue and link it with a closing keyword such as `Fixes #123` or `Closes #123` when the PR should complete the Issue.
- Do not normally create a PR first and backfill the Issue afterward. Trivial typo-only or clearly non-behavioral documentation fixes may be handled without an Issue.
- Keep changes narrowly scoped.
- Add tests around model/adapter/renderer/export behavior.
- Update docs when a design decision changes.
- **Before merging any user-visible UI/UX, interaction, renderer, preview, or output change, validate the latest PR head through the automatic PR Preview.** The preview deployment must be successful and must correspond to the latest PR head.
- Do not merge a user-visible change while its PR Preview is failed, cancelled, stale, or unavailable.
- When visual feel or interaction behavior matters, obtain manual confirmation from the PR Preview before merging. CI test/build is still required; Preview is an additional gate, not a replacement.
- Docs-only or purely internal changes may skip manual Preview validation only when the Preview provides no meaningful validation.
- If implementation pressure conflicts with `docs/direction.md`, do not silently change the architecture; surface the conflict and update the design deliberately.
