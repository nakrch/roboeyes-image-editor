# Deterministic spring transitions

Issue: #113

## Reference basis

- FluxGarage/RoboEyes keeps separate current/next eye state and smooths current values toward targets on each embedded update. That behavior establishes the target-state motion intent, but its `(current + next) / 2` style smoothing is frame-cadence dependent and is not copied literally here.
- Phase 3 already converts that intent into explicit-time easing transitions in `src/animation/transition.ts`.
- Mote Studio is used only as a workflow reference for interruptible spring-like transitions that retarget from the state already on screen. This project keeps the implementation renderer-independent and small-display focused.

## Model

Spring timing is a damped unit-step response with JSON-safe physical parameters:

- `stiffness > 0`
- `damping >= 0`
- `mass > 0`

`springResponse(parameters, elapsedMs)` uses a closed-form solution for underdamped, critically damped, and overdamped systems. It does not integrate browser frames, retain hidden mutable solver state, or depend on `requestAnimationFrame` cadence.

Built-in authoring presets are plain data:

- `gentle`
- `snappy`
- `bouncy`

They are conveniences, not renderer behavior names.

## Generic transition interface

Existing easing transitions remain valid as `FaceTransitionDefinition`. Spring transitions use `SpringFaceTransitionDefinition`; both are accepted by `GenericFaceTransitionDefinition` and sampled through `sampleGenericFaceTransition()`.

Both target the same generic `FaceStateTarget` surface and therefore support gaze, eye geometry/pose, spacing, rotation, and expression numeric fields without expression-name branches.

## Seeking and retargeting

A spring transition is sampled directly from `startTimeMs`, the requested logical `timeMs`, and its serialized spring parameters. Sampling time 420 ms directly is therefore equivalent to sampling many earlier timestamps and then 420 ms.

`retargetSpringFaceTransition()` first resolves the exact in-flight model at the retarget timestamp and stores that model as the new transition's explicit `from` state. Sampling the replacement transition at the retarget timestamp is byte/geometry-equivalent to the state immediately before retargeting, so there is no position snap.

The new spring begins with zero implicit velocity. Position continuity is guaranteed; velocity continuity is deliberately not hidden as mutable runtime state.

## Duration and safety

`durationMs` remains the authored hard completion boundary. Before that boundary the physical spring response determines progress; at the boundary the exact target state is returned.

Underdamped spring math may overshoot above 1. The physical response remains observable through `springResponse()`, but FaceModel sampling clamps interpolation progress to the established `0..1` model boundary. This deliberately prevents spring overshoot from bypassing gaze/canvas and eyelid-aperture safety constraints. Renderer code remains timer-free and physics-free.

## Reduced motion

Spring definitions are authoring data and are not rewritten by OS accessibility preferences. Preview/UI code may suppress automatic motion under `prefers-reduced-motion`, consistent with the existing Phase 3 policy. Deterministic export and direct logical-time sampling do not silently change serialized spring definitions.
