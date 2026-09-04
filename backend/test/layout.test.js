import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, defaultLayout, LIMITS } from '../src/layout.js';

const w = extra => ({ id: 'a', type: 'note', x: 10, y: 20, w: 300, h: 200, z: 1, config: {}, ...extra });

test('a well formed widget survives untouched', () => {
  const { widgets, errors } = sanitize([w()]);
  assert.deepEqual(errors, []);
  assert.deepEqual(widgets[0], w());
});

test('unknown widget types are dropped, not rejected outright', () => {
  // One broken widget must never stop the rest of the dashboard from loading.
  const { widgets, errors } = sanitize([w({ id: 'good' }), w({ id: 'bad', type: 'malware' })]);
  assert.equal(widgets.length, 1);
  assert.equal(widgets[0].id, 'good');
  assert.match(errors[0], /unknown type/);
});

test('positions and sizes are clamped instead of trusted', () => {
  const { widgets } = sanitize([w({ x: -500, y: -1, w: 5, h: 99999 })]);
  assert.equal(widgets[0].x, 0);
  assert.equal(widgets[0].y, 0);
  assert.equal(widgets[0].w, LIMITS.minW);
  assert.equal(widgets[0].h, LIMITS.maxH);
});

test('missing or non-numeric geometry falls back to something renderable', () => {
  const { widgets } = sanitize([{ type: 'note', x: 'abc', w: null }]);
  assert.equal(widgets[0].x, 0);
  assert.equal(widgets[0].w, LIMITS.minW);
  assert.ok(widgets[0].id.length > 0);
});

test('duplicate ids are made unique so React keys cannot collide', () => {
  const { widgets } = sanitize([w({ id: 'same' }), w({ id: 'same' })]);
  assert.notEqual(widgets[0].id, widgets[1].id);
});

test('config must be a plain object', () => {
  assert.deepEqual(sanitize([w({ config: [1, 2] })]).widgets[0].config, {});
  assert.deepEqual(sanitize([w({ config: null })]).widgets[0].config, {});
  assert.deepEqual(sanitize([w({ config: { view: 'open' } })]).widgets[0].config, { view: 'open' });
});

test('too many widgets are capped and reported', () => {
  const many = Array.from({ length: LIMITS.maxWidgets + 5 }, (_, i) => w({ id: 'w' + i }));
  const { widgets, errors } = sanitize(many);
  assert.equal(widgets.length, LIMITS.maxWidgets);
  assert.match(errors[0], /At most/);
});

test('a non-array payload yields an empty layout, not a crash', () => {
  assert.deepEqual(sanitize(null).widgets, []);
  assert.deepEqual(sanitize('nope').widgets, []);
  assert.match(sanitize(null).errors[0], /must be an array/);
});

test('both default layouts are themselves valid', () => {
  for (const b of ['desktop', 'mobile']) {
    const { widgets, errors } = sanitize(defaultLayout(b));
    assert.deepEqual(errors, []);
    assert.equal(widgets.length, defaultLayout(b).length);
  }
});
