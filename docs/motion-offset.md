# Motion-offset primitives

Issue #103 adds deterministic temporary motion on the Phase 3 `motion-offset` channel and builds RoboEyes-compatible Confused/Laugh one-shots from the same generic primitive.

## Reference basis

FluxGarage/RoboEyes V1.1.1 implements horizontal and vertical flicker by alternating a signed pixel offset once per rendered frame. Its default update rate is 50 fps, so one sign lasts about 20 ms and a complete `-A → +A` square cycle lasts about 40 ms. The reference Confused animation enables horizontal flicker with amplitude 20 for 500 ms; Laugh enables vertical flicker with amplitude 5 for 500 ms.

The editor preserves those default amplitudes/duration while replacing frame-count timing with explicit logical time.

## Generic primitive

A motion primitive is plain serializable data:

```ts
{
  axis: 'x' | 'y',
  amplitude: number,
  durationMs: number,
  periodMs: number,
  phase?: number,
  waveform?: 'square' | 'sine' | 'triangle' | 'jitter',
}
```

`periodMs` is the full waveform period, not a render-frame count. `phase` is expressed in cycles and wraps into `[0, 1)`.

Supported waveforms:

- `square` — reference-compatible alternating flicker
- `sine` — continuous shiver/bounce
- `triangle` — continuous linear shiver
- `jitter` — deterministic seeded piecewise-random displacement

Jitter uses the Phase 3 seeded random system and an event-specific stream, so sample order and browser frame cadence cannot change the result.

## Runtime actions

The `motion-offset` channel recognizes:

- `motion` — generic primitive configured by event payload
- `confused` — generic horizontal primitive using the reference-compatible defaults
- `laugh` — generic vertical primitive using the reference-compatible defaults
- `motion-stop` — clear the active offset immediately

Confused defaults:

```text
axis       x
amplitude  20
lifetime   500 ms
period     40 ms
waveform   square
```

Laugh defaults:

```text
axis       y
amplitude  5
lifetime   500 ms
period     40 ms
waveform   square
```

Payload fields can override the preset values without introducing renderer-specific behavior.

## Composition

Motion is applied after state transition, gaze/pose, and eye openness:

```text
base FaceModel
  → state transition
  → gaze / idle gaze
  → eye openness
  → temporary motion offset
  → transient effects
  → renderer
```

The motion layer moves both eye geometry positions together. It does **not** rewrite `FaceModel.gaze`, expression, or authored eye positions. This keeps temporary shiver separate from semantic gaze and avoids falsely triggering gaze-reactive Curious behavior merely because the face is shaking.

Offsets are clamped to the canvas-safe displacement range derived from the existing generic gaze constraints.

## Completion, retrigger, and stop

The event log remains the source of truth; there is no hidden mutable playback state.

- A one-shot is active from `startTimeMs` up to, but not including, `startTimeMs + durationMs`.
- At completion its contribution becomes exactly zero.
- A later trigger replaces the previous active primitive and starts its waveform phase from the new trigger timestamp.
- `motion-stop` clears the offset immediately.
- Once replaced or stopped, an older primitive never resumes.
- After completion/stop, the incoming gaze/pose and authored geometry are restored exactly.

## Determinism

For the same ordered runtime events, explicit `timeMs`, and seed, motion sampling returns the same offset and resolved `FaceModel` regardless of sampling order or render frame rate.

No `Date.now()`, `performance.now()`, `Math.random()`, `requestAnimationFrame`, or renderer frame counter participates in semantic motion timing.

## Layer boundary

This module owns the runtime/core motion primitives. Browser playback and visible authoring controls (#107), continuous behavior-profile composition (#104), and transient Sweat overlays (#106) are separate completed layers that reuse the same deterministic motion/effect architecture rather than adding renderer-specific branches.
