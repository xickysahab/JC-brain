/* Run: npm test  (node --test, no framework) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attention, rank, endOfWeek } from './score.js';

// Wednesday 2 Sep 2026, 10:00 local. Week (Mon-start) ends Sun 6 Sep.
const now = new Date(2026, 8, 2, 10, 0, 0);
const t = extra => ({
  title: 'x', status: 'Todo', priority: null, deadline: null,
  created_at: now.toISOString(), updated_at: now.toISOString(), ...extra
});
const at = extra => attention(t(extra), now);

test('label and base score follow the deadline table', () => {
  assert.equal(at({ deadline: new Date(2026, 8, 1, 10) }).label, 'OVERDUE');
  assert.equal(at({ deadline: new Date(2026, 8, 1, 10) }).score, 100);
  assert.equal(at({ deadline: new Date(2026, 8, 2, 18) }).label, 'DUE TODAY');
  assert.equal(at({ deadline: new Date(2026, 8, 3, 8) }).label, 'DUE SOON');   // 22h away
  assert.equal(at({ deadline: new Date(2026, 8, 3, 20) }).label, 'TOMORROW');  // 34h away
  assert.equal(at({ deadline: new Date(2026, 8, 5, 12) }).label, 'THIS WEEK');
  assert.equal(at({ deadline: new Date(2026, 8, 20, 12) }).label, 'LATER');
  assert.equal(at({}).label, 'UNSCHEDULED');
});

test('SOS shouts when the date is far off or missing, but a near deadline wins', () => {
  assert.equal(at({ priority: 'SOS' }).label, 'SOS');
  assert.equal(at({ priority: 'SOS', deadline: new Date(2026, 8, 20) }).label, 'SOS');
  assert.equal(at({ priority: 'SOS', deadline: new Date(2026, 8, 1) }).label, 'OVERDUE');
});

test('an untouched task with no deadline goes stale instead of disappearing', () => {
  assert.equal(at({ updated_at: new Date(2026, 7, 20).toISOString() }).label, 'STALE');
  assert.equal(at({ updated_at: new Date(2026, 7, 29).toISOString() }).label, 'UNSCHEDULED');
});

test('priority stacks on the deadline score', () => {
  assert.equal(at({ deadline: new Date(2026, 8, 2, 18), priority: 'High' }).score, 98);
  assert.equal(at({ deadline: new Date(2026, 8, 2, 18), priority: 'SOS' }).score, 102);
});

test('closed tasks score zero so they can never outrank live work', () => {
  const done = at({ deadline: new Date(2026, 8, 1), status: 'Done' });
  assert.equal(done.score, 0);
  assert.equal(done.label, 'DONE');
  assert.equal(at({ deadline: new Date(2026, 8, 1), status: 'Cancelled' }).score, 0);
});

test('rank puts the hottest task first', () => {
  const [first, , last] = rank([
    t({ title: 'later', deadline: new Date(2026, 8, 20) }),
    t({ title: 'today', deadline: new Date(2026, 8, 2, 18) }),
    t({ title: 'overdue', deadline: new Date(2026, 8, 1) })
  ], now).sort((a, b) => b.score - a.score);
  assert.equal(first.title, 'overdue');
  assert.equal(last.title, 'later');
});

test('the week ends on Sunday, not seven days from now', () => {
  assert.equal(endOfWeek(now).getDate(), 6);
});
