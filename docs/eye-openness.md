# Eye openness behavior

Issue #100 adds deterministic blink, wink, open/close, and persistent sleep behavior on top of the Phase 3 runtime from #98 and state transitions from #99.

## Reference basis

The implementation keeps the useful behavior patterns from RoboEyes-family implementations while replacing frame-dependent update rules with explicit-time sampling:

- FluxGarage/RoboEyes changes per-eye height targets for `close()`, `open()`, `blink()`, and per-eye blink, and keeps the eye vertically centered as height changes.
- `mchobby/micropython-roboeyes` exposes wink as a one-eye blink.
- `willrnsantana/robo_eyes_esphome` models `CLOSED` as a persistent low-openness state and suppresses normal blinking while closed.

The editor does not add renderer mood branches for these behaviors. Eye openness is resolved in the animation layer and applied to the generic `FaceModel` before rendering.

## Separation from expression

`ExpressionModel` continues to describe static eyelid/expression geometry such as Happy, Angry, Tired, Curious, Surprised, or custom asymmetric expressions.

Eye openness is a separate temporal multiplier:

```text
base / transitioned FaceModel
        ↓
expression stays intact
        +
eye openness (left/right 0..1)
        ↓
height-scaled FaceModel
        ↓
renderer
```

A blink therefore never rewrites `upperLid`, `lowerLid`, tilt, Curious settings, or per-eye expression overrides. Once the eye reopens, the underlying expression is exactly the same as before the blink.

## Authored state

The `eye-openness` channel accepts a serializable definition:

```ts
{
  kind: 'eye-openness',
  state: 'open' | 'closed' | 'sleep',
  closeDurationMs,
  holdDurationMs,
  openDurationMs,
  easing,
  closedScale,
}
```

`closed` and `sleep` are both persistent low-openness states. `sleep` is intentionally temporal/profile state rather than an expression or renderer mood string.

Defaults are tuned to the reference behavior while remaining explicit-time and frame-rate independent:

- close: 80 ms
- closed hold during blink: 20 ms
- reopen: 120 ms
- easing: `ease-in-out`
- closed scale: 0

These defaults reproduce the fast close / slightly softer reopen feel without copying RoboEyes' frame-dependent `(current + target) / 2` rule.

## Runtime actions

The `eye-openness` runtime channel recognizes:

- `blink` — both eyes close, hold, then reopen
- `wink-left` — left eye only
- `wink-right` — right eye only
- `close` — both eyes transition closed and stay closed
- `sleep` — both eyes transition to persistent sleep/closed state
- `open` — both eyes transition open and stay open

Runtime-event payloads may override close/hold/open duration, easing, and closed scale for that event only.

## Interruption and retrigger rules

Runtime events use the deterministic ordering from #98. For simultaneous events this means the later normalized event wins according to start time, channel, priority, caller order, and ID.

Within eye openness:

- **Blink while blinking:** restart the affected eye's blink from its exact currently resolved openness at the retrigger timestamp. There is no snap back to fully open first.
- **Wink during blink:** the winked eye rebases and restarts independently; the other eye continues its previous blink.
- **Close during blink:** each eye rebases from its current openness and transitions into persistent closed state.
- **Sleep during blink:** same interruption rule as close, but persistent state is recorded as `sleep`.
- **Open from closed/sleep:** rebase from the current low openness and transition to fully open.
- **Blink/wink while persistent closed/sleep:** ignored until an explicit `open` changes persistent state.

The evaluator reconstructs these results from the explicit event log. It does not depend on hidden mutable playback state or prior rendered frames.

## Vertical centering

`FaceModel` eye positions are center coordinates. Eye openness scales eye height while preserving `geometry.position.y`, so the top and bottom edges move symmetrically around the same center. No renderer-specific centering branch is required.

## Determinism

The same base model, eye-openness definition, ordered runtime events, and explicit `timeMs` always produce the same left/right openness and the same resolved `FaceModel`.

Sampling timestamps in a different order does not change results. Browser frame cadence is irrelevant.

## Scope boundary

This issue does not implement:

- automatic blink scheduling (#101)
- idle gaze (#102)
- Confused/Laugh motion primitives (#103)
- behavior profiles (#104)
- sequence authoring (#112)
- UI playback controls (#107)

Those features reuse this eye-openness channel rather than duplicating blink logic.
