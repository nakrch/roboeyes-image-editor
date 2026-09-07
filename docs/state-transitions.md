# Deterministic FaceModel state transitions

Issue #99 adds the generic `state + transition` layer on top of the explicit-time runtime from #98.

## Reference basis

The design keeps the useful intent of the RoboEyes family while changing the timing model:

- FluxGarage/RoboEyes separates target (`Next`) values from rendered/current values and converges eye size, spacing, position, radius, and expression geometry over repeated updates.
- `winsonwq/robo-eyes` similarly separates `targetPosition` from `currentPosition` and eases the current gaze toward the target.
- Mote Studio demonstrates interruptible retargeting from the pose already on screen. Spring physics remain outside this issue and are tracked in #113.

The editor does **not** copy frame-dependent rules such as `current = (current + next) / 2`. A transition is sampled from explicit logical time, so the same timestamp resolves to the same model regardless of render cadence.

## Serializable transition definition

A transition is plain JSON-safe data:

```text
kind: "face-model-transition"
id: stable caller/authored id
startTimeMs: explicit logical start time
durationMs: explicit duration
easing: stable easing id
target: partial generic FaceModel state
from: optional explicit rebase source
```

Supported easing IDs in #99:

- `linear`
- `ease-in`
- `ease-out`
- `ease-in-out`
- `smoothstep`

Executable easing functions are runtime implementation details and are never persisted as animation data. The definition shape leaves room for #113 to add spring profiles without changing renderer semantics.

## Animatable surface

The generic target can animate:

- gaze X/Y
- left/right eye position X/Y
- left/right eye width/height
- edge-to-edge eye spacing
- left/right corner radius
- left/right rotation
- the complete generic expression numeric surface
- left/right asymmetric expression overrides

Expression names are not part of transition logic. Neutral → Happy, Angry, Tired, Surprised, or a custom expression all use the same generic `ExpressionModel` interpolation.

Canvas size and colors are deliberately not part of the #99 target. They remain discrete/static until a later issue explicitly defines transition semantics for them.

## Timing and sampling

For a transition with logical progress `p`:

```text
p = clamp((timeMs - startTimeMs) / durationMs, 0, 1)
eased = easing(p)
frame = interpolate(source, target, eased)
```

A zero-duration transition switches to the target at its start time.

Sampling is stateless. Calling timestamps in forward order, reverse order, or skipping directly to a later timestamp does not change the result.

## Mid-transition retargeting

`retargetFaceTransition()` resolves the old transition at the explicit retarget timestamp and stores that resolved `FaceModel` as the new transition's `from` state.

```text
old transition sampled at t
        ↓
resolved FaceModel at t
        ↓
new transition.from
        ↓
new target
```

Therefore sampling the new transition at the retarget timestamp returns exactly the pose that was already on screen. There is no dependency on a hidden mutable "current" frame and no visible snap caused by restarting from the original authored base.

## Gaze targets

#99 provides three generic targeting layers:

- arbitrary `gaze: { x, y }` authored in canvas units
- normalized `[-1, 1]` X/Y targets mapped to current safe gaze bounds
- named 9-position helpers

Named generic directions:

```text
center
up / up-right / right / down-right
down / down-left / left / up-left
```

RoboEyes-compatible vocabulary is adapted onto the same generic helpers:

```text
DEFAULT
N / NE / E / SE / S / SW / W / NW
```

The adapter helper does not leak these names into the renderer or `FaceModel`.

## Safety and constraints

Every resolved transition target and intermediate frame reuses the existing Phase 2 model constraints:

- gaze is clamped to the current canvas-safe bounds
- eye geometry must still fit the canvas
- interpolated eyelid apertures must remain non-inverting

Expression interpolation works on resolved per-eye numeric values, so asymmetric overrides remain independent. Curious behavior remains continuous because the existing renderer derives gaze-reactive height from the interpolated gaze and expression at each sampled frame.

## #98 composition integration

`stateTransitionChannelResolver` adapts the serializable definition into the first animation composition channel:

```text
base
  ↓
state-transition   ← #99
  ↓
gaze-pose
  ↓
eye-openness
  ↓
motion-offset
  ↓
transient-effect
```

Later Phase 3 issues can compose gaze behavior, blink, motion, and transient effects on top without moving transition logic into the renderer.
