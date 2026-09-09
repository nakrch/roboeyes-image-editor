# State-sequence animation programs

Issue #112 adds a reusable ordered **state + transition program** layer above the low-level Phase 3 runtime. It is intentionally not a free-form video/keyframe timeline.

## Reference basis

- `mchobby/micropython-roboeyes` provides `StepData`, `Sequence`, and `Sequences`, scheduling eye actions at explicit elapsed times.
- Mote Studio separates authored animation documents from playback runtime and uses ordered steps, stable identities, hold/transition timing, and once/loop/ping-pong playback.

This project borrows those document/runtime concepts while keeping the authored surface generic and small-display focused.

## Program document

A program is versioned plain data:

```ts
{
  version: 1,
  id: 'program:greeting',
  playbackMode: 'once' | 'loop' | 'ping-pong',
  steps: [
    {
      id: 'neutral',
      target: { expression: neutralExpression },
      transitionDurationMs: 0,
      easing: 'ease-in-out',
      holdDurationMs: 800,
      actions: [],
    },
    {
      id: 'happy',
      target: { expression: happyExpression },
      transitionDurationMs: 200,
      easing: 'ease-in-out',
      holdDurationMs: 600,
    },
  ],
}
```

`transitionDurationMs` is the **entry transition into that step** from the previous resolved state. The first step transitions from the caller-supplied base `FaceModel`; subsequent steps transition from the previous authored step target.

Every partial `FaceStateTarget` is resolved against the same program base model before sampling. This prevents unspecified fields from accumulating drift across long loops.

## Step timing

Each visit to a step has two phases:

```text
entry transition → hold
```

Actions are scheduled relative to the start of the hold phase, not the transition start. `offsetMs` must remain inside the hold duration.

Zero transition and zero hold durations are valid. If the entire program has zero duration:

- `once` collapses to the final authored step target;
- repeating modes collapse to the first authored step target.

This avoids modulo-by-zero and hidden frame-order semantics.

## Playback modes

### once

Visits steps in authored order and stays at the final target after the total duration.

### loop

Visits steps in authored order repeatedly. At a cycle boundary, the first step's entry transition starts from the previous cycle's last step target.

### ping-pong

For three steps `A, B, C`, traversal is:

```text
A → B → C → B → A → B → C ...
```

Endpoints are not duplicated as extra holds. With two steps, ping-pong is naturally equivalent to alternating `A ↔ B`.

`animationProgramDurationMs()` returns the one-shot total duration for `once`, or one repeat-cycle duration for repeating modes.

## Deterministic seek

`sampleAnimationProgram(program, baseModel, timeMs)` computes the cycle, visit, transition progress, and resolved state directly from `timeMs`. It does not replay browser/render frames from time zero.

Sampling timestamps forward, backward, or randomly produces the same frame for the same inputs.

## Generic actions

A step may contain generic runtime actions such as:

```ts
{
  id: 'blink-now',
  channel: 'eye-openness',
  action: 'blink',
  offsetMs: 0,
}
```

This can express `idle → blink → idle` without renderer mood branches. The same mechanism can trigger motion one-shots, idle-gaze controls, or other runtime channel actions.

For repeating programs, action materialization only needs the current and previous cycle: authored actions repeat each cycle, so older copies cannot dominate the matching action from the previous cycle. This avoids replaying every historical cycle for an arbitrary seek.

## Ambient behavior composition

Sequence state resolution conceptually occupies the state-transition layer. Ambient definitions remain separate and follow the existing Phase 3 composition order:

```text
program state
  → ambient gaze/idle gaze
  → eye openness / auto blink
  → motion offset
  → transient effects
```

Therefore:

- ambient idle gaze **layers over** a sequence gaze target rather than being implicitly disabled;
- a program that needs exact authored gaze can include an explicit `idle-gaze-disable` action;
- program blink/wink/motion actions are ordinary explicit runtime events;
- auto-blink generated events keep their lower priority from #101, so an explicit program eye-openness action wins a simultaneous conflict;
- no sequence logic exists in the renderer.

## Pause, resume, restart, interruption

Playback state is not stored in the authored program. The existing Phase 3 playback clock owns position/status/rate, so pause/resume/restart/seek do not mutate step data.

External interruption can switch to another program or runtime event set while keeping the authored document immutable. A restart is a clock-position reset, not a rewrite of the program.

## Integration boundary

This document/runtime sequence layer is persisted through the preset/JSON integration from #105 and edited/previewed through the browser controls from #107. Those layers consume the same immutable program document and runtime clock semantics.

The program model intentionally does not introduce draggable keyframes, audio sync, executable callbacks, or per-frame authored data.
