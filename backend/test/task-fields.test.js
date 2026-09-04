import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, ALWAYS, DEFAULT_VISIBLE, sanitizeVisible, fieldDef } from '../src/task-fields.js';

test('title is always shown and is not something the user can switch off', () => {
  assert.deepEqual(ALWAYS, ['title']);
  assert.equal(fieldDef('title'), undefined);
});

test('unknown keys are dropped from a saved choice', () => {
  assert.deepEqual(sanitizeVisible(['owner', 'made_up', 'deadline']), ['deadline', 'owner']);
});

test('the saved order does not matter - the catalogue order wins', () => {
  // Otherwise the modal would rearrange itself depending on click order.
  const a = sanitizeVisible(['owner', 'status', 'deadline']);
  const b = sanitizeVisible(['deadline', 'owner', 'status']);
  assert.deepEqual(a, b);
  assert.deepEqual(a, ['status', 'deadline', 'owner']);
});

test('an empty or nonsense choice falls back instead of leaving a dead modal', () => {
  assert.deepEqual(sanitizeVisible([]), DEFAULT_VISIBLE);
  assert.deepEqual(sanitizeVisible(['nope']), DEFAULT_VISIBLE);
  assert.deepEqual(sanitizeVisible(null), DEFAULT_VISIBLE);
  assert.deepEqual(sanitizeVisible('owner'), DEFAULT_VISIBLE);
});

test('duplicates collapse', () => {
  assert.deepEqual(sanitizeVisible(['owner', 'owner']), ['owner']);
});

test('the default choice is itself valid', () => {
  assert.deepEqual(sanitizeVisible(DEFAULT_VISIBLE), DEFAULT_VISIBLE);
});

test('every enum field declares its options, every field a type', () => {
  const types = new Set(['text', 'textarea', 'enum', 'bool', 'number', 'datetime', 'bucket']);
  for (const f of FIELDS) {
    assert.ok(types.has(f.type), `${f.key} has an unknown type ${f.type}`);
    if (f.type === 'enum') assert.ok(Array.isArray(f.options) && f.options.length, `${f.key} needs options`);
  }
});

test('field keys are unique', () => {
  assert.equal(new Set(FIELDS.map(f => f.key)).size, FIELDS.length);
});
