# AGENTS.md

## Project intent

`roboeyes-image-editor` is a **Parametric Robot Face Editor for embedded/small displays**. It generalizes the design philosophy of RoboEyes rather than implementing a browser-only clone.

Read these before making architectural changes:

1. `docs/direction.md`
2. `docs/architecture.md`
3. `docs/roadmap.md`
4. the active GitHub Issue

## PR Preview handoff rule

**After opening an implementation PR, do not merge it before the latest PR Preview URL has been surfaced to the user in the chat and the user has explicitly approved proceeding with the merge.**

Required handoff sequence:

1. Open the PR.
2. Wait for the automatic **PR Preview** deployment for the latest PR head.
3. Retrieve the generated preview URL (normally posted to the PR by the preview workflow).
4. **Present that URL to the user in the chat as an easy-to-open link before merge.**
5. **STOP after presenting the URL. Do not merge in the same response/turn.**
6. Wait for a new user message that explicitly authorizes the merge, for example `OK`, `問題ない`, `mergeして`, or an equivalent clear approval.
7. For user-visible UI/UX, interaction, renderer, preview, animation, or output changes, the approval should follow the user's actual Preview inspection whenever meaningful.
8. Merge only after the normal CI/build gates, successful latest-head Preview, and explicit user approval are all satisfied.

The user's initial request to implement an Issue, general permission to proceed autonomously, CI success, or the fact that Preview provides little meaningful validation **must not be treated as merge approval**. The approval must come after the Preview URL has been shown.

Do not treat the GitHub PR comment alone as sufficient handoff: the preview URL must also be shown directly in the active user conversation. If a Preview is genuinely unavailable or not produced, state that explicitly and do not merge unless the user explicitly decides how to proceed.

## Reference-first implementation rule

Before designing or implementing behavior, geometry, expressions, animation, compatibility, rendering, controls, or export semantics that are related to RoboEyes, first inspect the current implementation in the original **FluxGarage/RoboEyes** repository.

Also inspect one or more representative derivative / port implementations when they are relevant and available (for example established MicroPython or other RoboEyes-derived libraries). Use them to understand how the behavior has been interpreted across implementations, not just how one codebase happens to encode it.

Preferred decision order:

1. **Original FluxGarage/RoboEyes behavior and implementation**
2. **Representative derivative/port implementations**
3. **Common behavioral/geometric pattern inferred from those references**
4. **Generic, renderer-independent abstraction for this editor**
5. **Project-specific UX improvements**, only when they do not silently change the intended RoboEyes-compatible behavior

Do not invent a new behavioral model first and compare it with RoboEyes afterward. Reference implementations should inform the design before implementation starts.

The project does **not** need to copy upstream APIs or internal data structures literally. Preserve the architecture below: translate reference behavior into a generic model rather than leaking RoboEyes-specific flags or APIs into the renderer. When the generic abstraction intentionally differs from upstream internals, document the reason in the Issue or PR.

For visual/expression work, prefer checking the actual drawing primitives, geometry calculations, interpolation/tweening, and edge-case handling in the reference implementations rather than relying only on README descriptions or screenshots.

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
- **Before any implementation PR is merged, surface the latest PR Preview URL directly to the user in the active chat, then stop and wait for explicit merge approval in a subsequent user message.**
- **Never call merge in the same response/turn in which the Preview URL is first presented.**
- Do not infer merge approval from the original implementation request, autonomous-execution permission, successful CI, or an internal/docs-only scope.
- Do not merge a user-visible change while its PR Preview is failed, cancelled, stale, or unavailable.
- When visual feel or interaction behavior matters, obtain manual confirmation from the PR Preview before merging. CI test/build is still required; Preview is an additional gate, not a replacement.
- Docs-only or purely internal changes may have little meaningful visual validation, but the URL handoff + explicit post-handoff approval gate still applies to implementation PRs when a Preview URL is produced.
- If implementation pressure conflicts with `docs/direction.md`, do not silently change the architecture; surface the conflict and update the design deliberately.
