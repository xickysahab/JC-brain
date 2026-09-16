import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDay, freeGaps, busyBlocks } from './plan.js';

const iso = (h, m = 0) => new Date(2026, 8, 16, h, m).toISOString();
const at = s => new Date(s).getHours() + new Date(s).getMinutes() / 60;
const task = (id, extra = {}) => ({
  id, title: id, status: 'Todo', priority: null, deadline: null,
  created_at: iso(0), updated_at: iso(0), ...extra
});
const day = { from: iso(9), to: iso(12), now: new Date(2026, 8, 16, 8) };

test('busy blocks merge when they overlap', () => {
  const merged = busyBlocks([
    { start_at: iso(9), end_at: iso(10) },
    { start_at: iso(9, 30), end_at: iso(11) }
  ]);
  assert.equal(merged.length, 1);
  assert.equal(at(new Date(merged[0][1]).toISOString()), 11);
});

test('gaps are what is left of the window', () => {
  const gaps = freeGaps(iso(9), iso(12), busyBlocks([{ start_at: iso(10), end_at: iso(11) }]));
  assert.equal(gaps.length, 2);
  assert.equal(at(new Date(gaps[0][0]).toISOString()), 9);
  assert.equal(at(new Date(gaps[1][0]).toISOString()), 11);
});

test('an empty day is filled back to back from the start', () => {
  const { placements } = planDay({ ...day, tasks: [task('a'), task('b')] });
  assert.equal(at(placements[0].start_at), 9);
  assert.equal(at(placements[1].start_at), 9.5);
});

test('meetings are never written over', () => {
  const { placements } = planDay({
    ...day,
    busy: [{ start_at: iso(9), end_at: iso(10) }],
    tasks: [task('a')]
  });
  assert.equal(at(placements[0].start_at), 10);
});

test('a task is skipped past a gap it cannot fit in', () => {
  // A 15-minute hole cannot hold a 30-minute slot; the task lands after it.
  const { placements } = planDay({
    ...day,
    busy: [{ start_at: iso(9, 15), end_at: iso(10) }],
    tasks: [task('a')]
  });
  assert.equal(at(placements[0].start_at), 10);
});

test('the most urgent task gets the first slot', () => {
  const { placements } = planDay({
    ...day,
    tasks: [task('later', { deadline: iso(23) }), task('overdue', { deadline: iso(1) })]
  });
  assert.equal(placements[0].id, 'overdue');
});

test('what does not fit is reported rather than dropped', () => {
  const tasks = Array.from({ length: 10 }, (_, i) => task('t' + i));
  const { placements, unplaced } = planDay({ ...day, from: iso(9), to: iso(10), tasks });
  assert.equal(placements.length, 2);          // one hour, two 30-minute slots
  assert.equal(unplaced.length, 8);
});

test('a fully booked day places nothing and loses nothing', () => {
  const { placements, unplaced } = planDay({
    ...day, busy: [{ start_at: iso(9), end_at: iso(12) }], tasks: [task('a')]
  });
  assert.deepEqual(placements, []);
  assert.equal(unplaced.length, 1);
});

test('slot length is configurable', () => {
  const { placements } = planDay({ ...day, tasks: [task('a'), task('b')], minutes: 60 });
  assert.equal(at(placements[1].start_at), 10);
});
