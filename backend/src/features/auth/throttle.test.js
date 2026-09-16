import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThrottle } from './throttle.js';

test('blocks only after the limit, and only inside the window', () => {
  const t = createThrottle({ limit: 3, windowMs: 1000 });
  const now = 1_000_000;

  t.fail('a', now); t.fail('a', now + 1);
  assert.equal(t.blocked('a', now + 2), false, 'two tries is not a block');

  t.fail('a', now + 2);
  assert.equal(t.blocked('a', now + 3), true, 'the third try blocks');

  // Past the window the count means nothing any more.
  assert.equal(t.blocked('a', now + 2000), false);
});

test('a success clears the count for that key alone', () => {
  const t = createThrottle({ limit: 2, windowMs: 1000 });
  t.fail('a'); t.fail('a'); t.fail('b'); t.fail('b');
  t.clear('a');
  assert.equal(t.blocked('a'), false);
  assert.equal(t.blocked('b'), true);
});

test('old entries are swept, so the map cannot grow for ever', () => {
  const t = createThrottle({ limit: 5, windowMs: 1000 });
  for (let i = 0; i < 50; i++) t.fail(`ip-${i}`, 1_000_000);
  assert.equal(t.size, 50);
  t.fail('fresh', 1_002_000);
  assert.equal(t.size, 1, 'everything older than the window is gone');
});
