import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueReminders, reminderText, startsAt, LEAD_MINUTES } from './due.js';

const now = new Date(2026, 8, 16, 10, 0, 0);
const min = n => new Date(now.getTime() + n * 60000).toISOString();
const task = extra => ({ id: 't1', title: 'Send proposal', status: 'Todo', priority: null,
                         start_date: null, deadline: null, bucket: null, ...extra });

test('a block time wins over a due date', () => {
  assert.equal(startsAt(task({ start_date: min(5), deadline: min(600) })), min(5));
  assert.equal(startsAt(task({ deadline: min(600) })), min(600));
  assert.equal(startsAt(task({})), null);
});

test('fires inside the lead window, not before it', () => {
  assert.equal(dueReminders([task({ deadline: min(LEAD_MINUTES - 1) })], now).length, 1);
  assert.equal(dueReminders([task({ deadline: min(LEAD_MINUTES + 5) })], now).length, 0);
});

test('something that slipped past while the server was down still fires', () => {
  assert.equal(dueReminders([task({ deadline: min(-1) })], now).length, 1);
});

test('but ancient history is never replayed', () => {
  // Otherwise turning reminders on would dump a month of notifications at once.
  assert.equal(dueReminders([task({ deadline: min(-120) })], now).length, 0);
});

test('finished work never nags', () => {
  assert.equal(dueReminders([task({ deadline: min(1), status: 'Done' })], now).length, 0);
  assert.equal(dueReminders([task({ deadline: min(1), status: 'Cancelled' })], now).length, 0);
});

test('a task with no time at all is not a reminder', () => {
  assert.equal(dueReminders([task({})], now).length, 0);
});

test('a broken date is skipped rather than thrown on', () => {
  assert.equal(dueReminders([task({ deadline: 'not a date' })], now).length, 0);
});

test('the words say when, and say SOS when it is', () => {
  assert.match(reminderText(task({ deadline: min(5) }), now).body, /in 5 min/);
  assert.match(reminderText(task({ deadline: min(-5) }), now).body, /was due/);
  assert.equal(reminderText(task({ deadline: min(5), priority: 'SOS' }), now).title, 'SOS · Send proposal');
  assert.equal(reminderText(task({ deadline: min(5) }), now).title, 'Send proposal');
});

test('the bucket rides along when there is one', () => {
  assert.match(reminderText(task({ deadline: min(5), bucket: 'Sales' }), now).body, /Sales/);
});

test('one notification per task, so a phone does not stack duplicates', () => {
  assert.equal(reminderText(task({ deadline: min(5) }), now).tag, 'task-t1');
});
