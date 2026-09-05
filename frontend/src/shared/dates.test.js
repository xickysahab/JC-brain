/* Run: npm test  (node --test, no framework, no DOM) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOfWeek, monthGridStart, addDays, sameDay, hourOf, layOut } from '../shared/dates.js';

const ev = (title, from, to) => ({
  id: title, title,
  start_at: new Date(2026, 8, 2, ...from).toISOString(),
  end_at: new Date(2026, 8, 2, ...to).toISOString()
});
const byTitle = laid => Object.fromEntries(laid.map(e => [e.title, { lane: e.lane, lanes: e.lanes }]));

test('weeks start on Monday, whichever day you ask about', () => {
  for (const day of [31, 1, 2, 3, 4, 5, 6]) {
    const d = new Date(2026, day > 20 ? 7 : 8, day, 12);   // 31 Aug .. 6 Sep 2026
    assert.equal(startOfWeek(d).getDate(), 31);
    assert.equal(startOfWeek(d).getMonth(), 7);            // August
  }
});

test('the month grid starts on the Monday on or before the 1st', () => {
  const start = monthGridStart(new Date(2026, 8, 15));     // September 2026
  assert.equal(start.getDay(), 1);                         // Monday
  assert.equal(start.getDate(), 31);                       // 31 Aug
  // 42 cells must cover every day of the month.
  const last = addDays(start, 41);
  assert.ok(last >= new Date(2026, 8, 30));
});

test('hourOf turns a time into a float the grid can position', () => {
  assert.equal(hourOf(new Date(2026, 8, 2, 14, 30)), 14.5);
  assert.equal(hourOf(new Date(2026, 8, 2, 9, 0)), 9);
});

test('sameDay ignores the time of day', () => {
  assert.ok(sameDay(new Date(2026, 8, 2, 0, 1), new Date(2026, 8, 2, 23, 59)));
  assert.ok(!sameDay(new Date(2026, 8, 2, 23, 59), new Date(2026, 8, 3, 0, 1)));
});

test('events that do not overlap all take the full width', () => {
  const laid = byTitle(layOut([ev('a', [9], [10]), ev('b', [11], [12])]));
  assert.deepEqual(laid.a, { lane: 0, lanes: 1 });
  assert.deepEqual(laid.b, { lane: 0, lanes: 1 });
});

test('two events at the same time sit side by side', () => {
  const laid = byTitle(layOut([ev('a', [10], [11]), ev('b', [10], [11])]));
  assert.deepEqual(laid.a, { lane: 0, lanes: 2 });
  assert.deepEqual(laid.b, { lane: 1, lanes: 2 });
});

test('a lane is reused once the event holding it has ended', () => {
  // a 10:00-10:30, b 10:00-11:30, c 10:45-12:00 -> c can take a's lane back
  const laid = byTitle(layOut([ev('a', [10], [10, 30]), ev('b', [10], [11, 30]), ev('c', [10, 45], [12])]));
  assert.equal(laid.a.lane, 0);
  assert.equal(laid.b.lane, 1);
  assert.equal(laid.c.lane, 0);
  assert.equal(laid.c.lanes, 2);   // the whole overlapping group is 2 wide
});

test('layOut does not mutate the events it was given', () => {
  const input = [ev('a', [10], [11]), ev('b', [10], [11])];
  layOut(input);
  assert.equal(input[0].lane, undefined);
});
