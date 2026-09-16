import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, rubberband, resist, velocityTracker,
         springStep, springAtRest } from './spring.js';

test('projection grows with speed and flips with direction', () => {
  assert.ok(project(1000) > project(500), 'a faster flick travels further');
  assert.equal(project(0), 0);
  assert.equal(project(-500), -project(500));
  // A 1000px/s flick at the scroll deceleration rate carries about half a
  // screen - the number that makes a flick feel like a throw.
  assert.ok(project(1000) > 400 && project(1000) < 600, project(1000));
});

test('a snappier deceleration rate travels less', () => {
  assert.ok(project(1000, 0.99) < project(1000, 0.998));
});

test('rubber-banding gives ground at first and almost none later', () => {
  const d = 400;
  const small = rubberband(10, d), large = rubberband(400, d);
  assert.ok(small < 10, 'even a small overshoot is resisted');
  assert.ok(large < 400 / 2, 'a large one barely moves at all');
  assert.ok(large > small, 'but it never stops dead');
  assert.equal(rubberband(0, d), 0);
});

test('resist passes through inside the bounds and resists outside', () => {
  assert.equal(resist(50, 0, 100, 400), 50);
  assert.ok(resist(-40, 0, 100, 400) > -40 && resist(-40, 0, 100, 400) < 0, 'below the floor');
  assert.ok(resist(140, 0, 100, 400) < 140 && resist(140, 0, 100, 400) > 100, 'above the ceiling');
});

test('velocity is read over a window, not between the last two events', () => {
  const t = velocityTracker(100);
  t.add(0, 0, 1000);
  t.add(50, 0, 1050);
  t.add(100, 0, 1100);
  assert.equal(Math.round(t.read().vx), 1000, '100px in 100ms is 1000px/s');
});

test('a finger that stops before lifting hands over nothing', () => {
  const t = velocityTracker(100);
  t.add(0, 0, 1000);
  t.add(200, 0, 1100);      // a fast move...
  t.add(200, 0, 1180);      // ...then held still
  t.add(200, 0, 1260);
  assert.equal(t.read().vx, 0, 'the old speed has fallen out of the window');
});

test('one sample, or two in the same millisecond, is not a velocity', () => {
  const t = velocityTracker();
  t.add(0, 0, 1000);
  assert.deepEqual(t.read(), { vx: 0, vy: 0 });
  t.add(80, 0, 1000);
  assert.deepEqual(t.read(), { vx: 0, vy: 0 }, 'no division by zero');
});

test('a critically damped spring reaches its target and never overshoots', () => {
  let s = { value: 0, velocity: 0 };
  let max = 0;
  for (let i = 0; i < 400; i++) {
    s = springStep(s, 100, 1 / 60, { damping: 1, response: 0.4 });
    max = Math.max(max, s.value);
  }
  assert.ok(springAtRest(s, 100), `settled at ${s.value}`);
  assert.ok(max <= 100.5, `no overshoot, peaked at ${max}`);
});

test('below critical damping it overshoots, which is the point of bounce', () => {
  let s = { value: 0, velocity: 0 };
  let max = 0;
  for (let i = 0; i < 400; i++) {
    s = springStep(s, 100, 1 / 60, { damping: 0.6, response: 0.4 });
    max = Math.max(max, s.value);
  }
  assert.ok(max > 100, `expected overshoot, peaked at ${max}`);
  assert.ok(springAtRest(s, 100), 'and it still comes to rest');
});

test('a release velocity carries the value past the target before it returns', () => {
  // Thrown at 900px/s toward a target only 10px away: it must go beyond and
  // come back, because a hand-off that ignores speed is the visible seam.
  let s = { value: 0, velocity: 900 };
  let max = 0;
  for (let i = 0; i < 400; i++) {
    s = springStep(s, 10, 1 / 60, { damping: 1, response: 0.4 });
    max = Math.max(max, s.value);
  }
  assert.ok(max > 10, `carried to ${max}`);
  assert.ok(springAtRest(s, 10));
});

test('a long frame is clamped rather than integrated whole', () => {
  // 2s in one step would send an unclamped spring to infinity.
  const big = springStep({ value: 0, velocity: 0 }, 100, 1 / 30, { damping: 1, response: 0.4 });
  assert.ok(Number.isFinite(big.value) && Math.abs(big.value) < 200, big.value);
});
