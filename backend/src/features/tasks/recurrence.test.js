import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextDate, nextInstance } from './recurrence.js';

const at = s => new Date(s);
const day = d => d.toISOString().slice(0, 10);

test('weekly keeps the weekday', () => {
  assert.equal(day(nextDate('Weekly', at('2026-09-14T09:00:00Z'), at('2026-09-14T10:00:00Z'))), '2026-09-21');
});

test('weekdays skips the weekend', () => {
  // Friday 18 Sep 2026 -> Monday 21st, not Saturday.
  assert.equal(day(nextDate('Weekdays', at('2026-09-18T09:00:00Z'), at('2026-09-18T10:00:00Z'))), '2026-09-21');
});

test('monthly on the 31st clamps and does not drift', () => {
  const feb = nextDate('Monthly', at('2026-01-31T12:00:00Z'), at('2026-01-31T13:00:00Z'));
  assert.equal(day(feb), '2026-02-28');
  // The March one comes off the anchor, so it is the 31st again - not the 28th.
  const mar = nextDate('Monthly', at('2026-01-31T12:00:00Z'), at('2026-03-01T00:00:00Z'));
  assert.equal(day(mar), '2026-03-31');
});

test('a long-overdue task lands on its next real slot, not the day after', () => {
  const next = nextDate('Weekly', at('2026-01-05T09:00:00Z'), at('2026-09-16T09:00:00Z'));
  assert.ok(next > at('2026-09-16T09:00:00Z'));
  assert.equal(next.getUTCDay(), 1);              // still a Monday
});

test('a rule we do not know produces nothing', () => {
  assert.equal(nextDate('Hourly', at('2026-09-14T09:00:00Z')), null);
  assert.equal(nextInstance({ repeat: 'Hourly', deadline: '2026-09-14T09:00:00Z' }), null);
  assert.equal(nextInstance({ deadline: '2026-09-14T09:00:00Z' }), null);
});

test('the copy keeps its shape and its span, and comes back open', () => {
  const next = nextInstance({
    title: 'Standup', repeat: 'Daily', priority: 'High', owner: 'riya',
    status: 'Done', completed_at: '2026-09-16T10:00:00Z',
    start_date: '2026-09-16T09:00:00Z', deadline: '2026-09-16T09:30:00Z',
    subtasks: [{ id: 'a', title: 'Notes', done: true }]
  }, at('2026-09-16T10:00:00Z'));

  assert.equal(next.title, 'Standup');
  assert.equal(next.priority, 'High');
  assert.equal(next.status, 'Todo');
  assert.equal(next.completed_at, undefined);
  assert.equal(day(at(next.start_date)), '2026-09-17');
  // 30 minutes wide before, 30 minutes wide after.
  assert.equal(at(next.deadline) - at(next.start_date), 30 * 60 * 1000);
  assert.equal(next.subtasks[0].done, false);
  assert.notEqual(next.subtasks[0].id, 'a');     // a fresh copy, not a shared row
});
