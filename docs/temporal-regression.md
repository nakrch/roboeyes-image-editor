# Temporal regression policy

Issue #108 extends the static Phase 2 regression strategy across logical time. The animation runtime is deterministic from explicit authored data, runtime events, `timeMs`, and seed, so temporal tests should normally compare model/geometry signatures rather than browser-rendered raster goldens.

## What the suite protects

The temporal regression suite covers four complementary layers:

1. **Exact fixed-time fixtures**
   - state/geometry/expression transition start, midpoint, and end
   - blink, independent wink, persistent close/sleep, reopen, and simultaneous-event priority
   - Confused/Laugh sign and completion samples
   - fixed-seed Auto-blink schedules and Idle target schedules
2. **Cadence and seek invariants**
   - direct timestamp sampling is independent of prior sampling order
   - equivalent logical timestamps agree after simulated 20, 25, 30, 60, and 120 Hz playback
   - Auto-blink and Idle use isolated deterministic substreams/control channels
   - ten-minute seeded schedules do not accumulate redraw-cadence drift
3. **Program/profile regression**
   - representative Happy, Tired/Scary-like, Angry, and Curious composition
   - once/loop/ping-pong sequence timing and transition/hold boundaries
   - versioned animation/program/preset JSON round trips preserve stable IDs, timing, easing, actions, and seed
4. **Temporal invariant sweeps**
   - representative transitions, Idle, eye-state events, motion one-shots, behavior profiles, and loop sequences are sampled across many timestamps and seeds
   - resolved numbers stay finite
   - eye dimensions/radii stay non-negative
   - eyelid apertures do not invert
   - gaze and geometry stay canvas-safe
   - temporary one-shot offsets disappear after completion
   - pure sampling does not mutate authored/base data

## Fixture update policy

Hard-coded temporal signatures and seeded schedules are compatibility fixtures, not snapshots to refresh automatically.

Update a fixture only when the corresponding reference timing, geometry, event priority, seeded scheduling rule, or interpolation contract is intentionally changed. The pull request that changes a fixture must explain:

- which behavior contract changed;
- why the new behavior is intended;
- which exact temporal signatures/schedule entries changed; and
- whether the change affects compatibility with existing presets or RoboEyes-derived behavior.

A test failure caused only by an unintended refactor or redraw cadence change should be fixed in the implementation rather than accepted by regenerating fixture values.

## Regression boundaries

The temporal suite does not replace the Phase 2 Visual Regression Gallery. Static gallery fixtures remain static, and evaluating a model with animation absent must preserve the same standalone SVG output. Existing static SVG/PNG export parity remains a separate contract.

Raster animation goldens should be added only when model/geometry signatures cannot express a user-visible temporal regression clearly enough. This keeps the core suite small, reviewable, renderer-independent, and suitable for lower-redraw embedded targets as well as desktop browsers.
