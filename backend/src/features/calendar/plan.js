import { attention } from '../../shared/score.js';

/* Fills a day from the task list.

   The scoring engine already knows what matters most; the calendar already
   knows what is booked. Planning a day is just walking one against the other,
   so this is arrangement rather than new machinery. Nothing is invented: a
   task only gets a time if there is genuinely a gap for it. */

export const DEFAULT_MINUTES = 30;
const MS = 60000;

/** Merges overlapping busy intervals into a sorted, disjoint list. */
export function busyBlocks(items) {
  const blocks = items
    .map(i => [new Date(i.start_at).getTime(), new Date(i.end_at).getTime()])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .sort((x, y) => x[0] - y[0]);

  const merged = [];
  for (const [start, end] of blocks) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** The gaps left inside [from, to] once the busy blocks are removed. */
export function freeGaps(from, to, busy) {
  const start = new Date(from).getTime(), end = new Date(to).getTime();
  const gaps = [];
  let cursor = start;
  for (const [a, b] of busy) {
    if (b <= start || a >= end) continue;
    if (a > cursor) gaps.push([cursor, Math.min(a, end)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < end) gaps.push([cursor, end]);
  return gaps.filter(([a, b]) => b > a);
}

/**
 * @param {object} o
 * @param {Array}  o.tasks     candidates: open, with no start_date yet
 * @param {Array}  o.busy      events and already-scheduled tasks for the day
 * @param {string} o.from      start of the working window, ISO
 * @param {string} o.to        end of the working window, ISO
 * @param {number} o.minutes   slot length
 * @returns {{placements: Array, unplaced: Array}}
 */
export function planDay({ tasks, busy = [], from, to, minutes = DEFAULT_MINUTES, now = new Date() }) {
  const slot = minutes * MS;
  const gaps = freeGaps(from, to, busyBlocks(busy));

  // Most urgent first - the same ranking the task list already shows, so the
  // plan never disagrees with what the user was looking at.
  const ranked = [...tasks]
    .map(t => ({ t, score: attention(t, now).score }))
    .sort((a, b) => b.score - a.score || new Date(a.t.created_at) - new Date(b.t.created_at))
    .map(x => x.t);

  const placements = [];
  const unplaced = [];
  let gi = 0;
  let cursor = gaps.length ? gaps[0][0] : null;

  for (const task of ranked) {
    while (gi < gaps.length && cursor + slot > gaps[gi][1]) {
      gi++;
      cursor = gi < gaps.length ? gaps[gi][0] : null;
    }
    if (gi >= gaps.length) { unplaced.push(task); continue; }
    placements.push({
      id: task.id,
      title: task.title,
      start_at: new Date(cursor).toISOString(),
      end_at: new Date(cursor + slot).toISOString()
    });
    cursor += slot;
  }
  return { placements, unplaced };
}
