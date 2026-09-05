import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize, GROUPS } from './stats.js';

const now = new Date(2026, 8, 2, 10, 0, 0);          // Wed 2 Sep 2026
const iso = (...a) => new Date(...a).toISOString();
const t = extra => ({
  status: 'Todo', priority: null, owner: null, client: null, bucket: null, project: null,
  deadline: null, created_at: iso(2026, 8, 2), updated_at: iso(2026, 8, 2), ...extra
});
const byKey = r => Object.fromEntries(r.groups.map(g => [g.key, g.value]));

test('counts land in the right bucket and total matches', () => {
  const r = summarize([t(), t(), t({ status: 'In Progress' })], { groupBy: 'status' }, now);
  assert.deepEqual(byKey(r), { Todo: 2, 'In Progress': 1 });
  assert.equal(r.total, 3);
});

test('scope decides which tasks are counted at all', () => {
  const tasks = [t(), t({ status: 'Done' }), t({ status: 'Cancelled' })];
  assert.equal(summarize(tasks, { groupBy: 'status', scope: 'open' }, now).total, 1);
  assert.equal(summarize(tasks, { groupBy: 'status', scope: 'done' }, now).total, 1);
  assert.equal(summarize(tasks, { groupBy: 'status', scope: 'all' }, now).total, 3);
});

test('empty dimensions get a named bucket instead of being dropped', () => {
  const r = summarize([t({ owner: 'riya' }), t()], { groupBy: 'owner' }, now);
  assert.deepEqual(byKey(r), { riya: 1, Unassigned: 1 });
  assert.deepEqual(byKey(summarize([t()], { groupBy: 'priority' }, now)), { None: 1 });
  assert.deepEqual(byKey(summarize([t()], { groupBy: 'client' }, now)), { 'No client': 1 });
  assert.deepEqual(byKey(summarize([t({ bucket: 'Sales' }), t()], { groupBy: 'bucket' }, now)), { Sales: 1, 'No bucket': 1 });
  // charts saved before buckets existed said "category"; that must still work
  assert.deepEqual(byKey(summarize([t({ bucket: 'Sales' })], { groupBy: 'category' }, now)), { Sales: 1 });
});

test('known dimensions keep a fixed slice order, so a pie does not reshuffle', () => {
  const r = summarize([t({ status: 'In Progress' }), t({ status: 'Todo' })], { groupBy: 'status' }, now);
  assert.deepEqual(r.groups.map(g => g.key), ['Todo', 'In Progress']);
});

test('free-text dimensions are ordered biggest first', () => {
  const tasks = [t({ client: 'a' }), t({ client: 'b' }), t({ client: 'b' })];
  assert.deepEqual(summarize(tasks, { groupBy: 'client' }, now).groups.map(g => g.key), ['b', 'a']);
});

test('due buckets follow the deadline, not the status', () => {
  const r = summarize([
    t({ deadline: iso(2026, 8, 1) }),          // yesterday
    t({ deadline: iso(2026, 8, 2, 18) }),      // today
    t({ deadline: iso(2026, 8, 5) }),          // Saturday, same week
    t({ deadline: iso(2026, 8, 25) }),         // later
    t()                                        // no date
  ], { groupBy: 'due' }, now);
  assert.deepEqual(byKey(r), { Overdue: 1, Today: 1, 'This week': 1, Later: 1, 'No date': 1 });
});

test('grouping by a date gives an ascending series', () => {
  const r = summarize([
    t({ created_at: iso(2026, 8, 3) }),
    t({ created_at: iso(2026, 8, 1) }),
    t({ created_at: iso(2026, 8, 1) })
  ], { groupBy: 'created', range: 'all' }, now);
  assert.deepEqual(r.groups.map(g => g.key), ['2026-09-01', '2026-09-03']);
  assert.deepEqual(r.groups.map(g => g.value), [2, 1]);
});

test('tasks with no value for a date dimension are skipped, not bucketed as null', () => {
  const r = summarize([t({ deadline: iso(2026, 8, 4) }), t()], { groupBy: 'deadline' }, now);
  assert.equal(r.total, 1);
  assert.equal(r.groups.length, 1);
});

test('range trims by creation date', () => {
  const tasks = [t({ created_at: iso(2026, 7, 1) }), t({ created_at: iso(2026, 8, 1) })];
  assert.equal(summarize(tasks, { groupBy: 'status', range: 'all' }, now).total, 2);
  assert.equal(summarize(tasks, { groupBy: 'status', range: 'last_7' }, now).total, 1);
  assert.equal(summarize(tasks, { groupBy: 'status', range: 'this_month' }, now).total, 1);
});

test('unknown options fall back instead of throwing', () => {
  const r = summarize([t()], { groupBy: 'nonsense', scope: 'nope', range: 'never' }, now);
  assert.equal(r.groupBy, 'status');
  assert.equal(r.scope, 'open');
  assert.equal(r.range, 'all');
});

test('no tasks yields an empty chart, not an error', () => {
  const r = summarize([], { groupBy: 'status' }, now);
  assert.deepEqual(r.groups, []);
  assert.equal(r.total, 0);
});

test('every dimension advertised is one summarize can actually group by', () => {
  for (const key of Object.keys(GROUPS)) {
    assert.doesNotThrow(() => summarize([t({ deadline: iso(2026, 8, 4) })], { groupBy: key }, now));
  }
});
