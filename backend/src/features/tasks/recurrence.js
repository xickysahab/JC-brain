/* Repeat rules.

   A repeating task is not a task with a calendar attached - it is a template
   that leaves one copy behind every time it is finished. This file knows what
   each rule means and nothing else; the route just asks it for the next row. */

import { randomUUID } from 'node:crypto';

export const RULES = ['Daily', 'Weekdays', 'Weekly', 'Fortnightly', 'Monthly', 'Yearly'];

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/* Month arithmetic clamps: 31 Jan + 1 month is 28 Feb, not 3 March. Always
   stepped from the original anchor rather than from the previous result, so a
   task due on the 31st does not drift down to the 28th for good. */
function addMonths(d, n) {
  const x = new Date(d), day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return x;
}

const addWeekdays = (d, n) => {
  let x = new Date(d);
  for (let i = 0; i < n; i++) { do { x = addDays(x, 1); } while (x.getDay() === 0 || x.getDay() === 6); }
  return x;
};

const STEP = {
  Daily:       (d, k) => addDays(d, k),
  Weekdays:    (d, k) => addWeekdays(d, k),
  Weekly:      (d, k) => addDays(d, 7 * k),
  Fortnightly: (d, k) => addDays(d, 14 * k),
  Monthly:     (d, k) => addMonths(d, k),
  Yearly:      (d, k) => addMonths(d, 12 * k)
};

/** The first occurrence after `after`. Steps from the anchor, so a task left
    unfinished for a month reappears on its next real slot - not a month late.
    @returns {Date|null} */
export function nextDate(rule, anchor, after = new Date()) {
  const step = STEP[rule];
  const from = new Date(anchor);
  if (!step || isNaN(from)) return null;
  for (let k = 1; k <= 400; k++) {
    const d = step(from, k);
    if (d > after) return d;
  }
  return null;      // more than 400 steps behind: stop rather than spin
}

const DATE_KEYS = ['deadline', 'start_date', 'follow_up_date'];

/* Fields the copy inherits. Deliberately not: status, completed_at,
   created_at, updated_at - the copy is new and open. */
const CARRY = [
  'title', 'description', 'priority', 'bucket_id', 'owner', 'client', 'project',
  'delegated', 'blocked', 'waiting_on', 'requires_thinking', 'revenue_impact',
  'revenue_value', 'pinned', 'repeat', 'subtasks'
];

/** The next instance of a finished repeating task, or null when it does not
    repeat. Every date moves by the same delta, so a task that started 9am and
    was due 10am still spans an hour next week. */
export function nextInstance(task, now = new Date()) {
  if (!task?.repeat || !STEP[task.repeat]) return null;

  const anchor = task.start_date || task.deadline || task.created_at || now;
  const next = nextDate(task.repeat, anchor, now);
  if (!next) return null;
  const delta = next - new Date(anchor);

  const row = {};
  for (const k of CARRY) if (task[k] != null) row[k] = task[k];
  for (const k of DATE_KEYS) if (task[k]) row[k] = new Date(new Date(task[k]).getTime() + delta).toISOString();
  // A checklist is a list of steps, not a record of one run: the copy starts unticked.
  if (Array.isArray(row.subtasks)) row.subtasks = row.subtasks.map(s => ({ ...s, id: randomUUID(), done: false }));
  row.status = 'Todo';
  return row;
}
