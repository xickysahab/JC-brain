/* Which reminders are due right now.

   The attention engine has always known what needs attention; it just had no
   way to say so unless someone opened the tab - which is precisely the case
   where they did not need reminding. This is the part that decides, kept pure
   so the deciding can be tested without a clock, a database or a browser. */

export const LEAD_MINUTES = 10;
const MS = 60000;

/** The moment a task actually starts: its block if it has one, else its due date. */
export const startsAt = t => t.start_date || t.deadline || null;

/**
 * @param {Array}  tasks   open tasks with their times
 * @param {Date}   now
 * @param {object} opts    lead: how many minutes before to fire
 * @returns {Array<{task, kind, at}>}
 */
export function dueReminders(tasks, now = new Date(), { lead = LEAD_MINUTES } = {}) {
  const t0 = now.getTime();
  const out = [];

  for (const task of tasks) {
    if (task.status === 'Done' || task.status === 'Cancelled') continue;
    const when = startsAt(task);
    if (!when) continue;
    const at = new Date(when).getTime();
    if (!Number.isFinite(at)) continue;

    // Fires in the lead window before the time, and for anything that slipped
    // past while the server was down - but never for something long gone, or
    // enabling reminders would replay a month of history at once.
    const early = at - lead * MS;
    if (t0 >= early && t0 <= at + 60 * MS) out.push({ task, kind: 'due', at: new Date(at).toISOString() });
  }
  return out;
}

/** The words that reach someone on a lock screen. Short, specific, no jargon. */
export function reminderText(task, now = new Date()) {
  const at = new Date(startsAt(task));
  const mins = Math.round((at - now) / MS);
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const when = mins > 1 ? `in ${mins} min · ${time}`
             : mins >= -1 ? `now · ${time}`
             : `was due ${time}`;
  return {
    title: task.priority === 'SOS' ? `SOS · ${task.title}` : task.title,
    body: [when, task.bucket].filter(Boolean).join('  ·  '),
    tag: `task-${task.id}`
  };
}
