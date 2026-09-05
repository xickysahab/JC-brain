/* Deadline & urgency engine. This is the one piece of the original 28-section
   spec that survived the re-scope: charts and list sorting both run on it. */

const CONFIG = {
  scores: {
    OVERDUE: 100, 'DUE TODAY': 90, 'DUE SOON': 85, SOS: 80,
    TOMORROW: 75, 'THIS WEEK': 60, STALE: 45, LATER: 20, UNSCHEDULED: 10
  },
  priority: { SOS: 12, High: 8, Medium: 3, Low: 0 },
  staleDays: 7
};

const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

/** End of the current week, local time, Monday-start: Sunday 23:59:59.999. */
export function endOfWeek(now) {
  const d = startOfDay(now);
  d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
  d.setHours(23, 59, 59, 999);
  return d;
}

/** The time-derived half of the score: { label, base }. */
function urgencyLabel(task, now = new Date(), cfg = CONFIG) {
  const sos = task.priority === 'SOS';
  if (task.deadline) {
    const dl = new Date(task.deadline);
    const dayDiff = daysBetween(now, dl);
    let label;
    if (dl < now) label = 'OVERDUE';
    else if (dayDiff === 0) label = 'DUE TODAY';
    else if (dl - now <= 86400000) label = 'DUE SOON';
    else if (dayDiff === 1) label = 'TOMORROW';
    else if (dl <= endOfWeek(now)) label = 'THIS WEEK';
    else label = sos ? 'SOS' : 'LATER';       // SOS with a far-off date still shouts
    return { label, base: cfg.scores[label] };
  }
  if (sos) return { label: 'SOS', base: cfg.scores.SOS };
  const touched = new Date(task.updated_at || task.created_at || now);
  if (daysBetween(touched, now) > cfg.staleDays) return { label: 'STALE', base: cfg.scores.STALE };
  return { label: 'UNSCHEDULED', base: cfg.scores.UNSCHEDULED };
}

/** attention_score = deadline score + priority modifier. Keep the formula here,
    not scattered through queries - P4 charts will read the same numbers. */
export function attention(task, now = new Date(), cfg = CONFIG) {
  const { label, base } = urgencyLabel(task, now, cfg);
  const closed = task.status === 'Done' || task.status === 'Cancelled';
  const score = closed ? 0 : base + (cfg.priority[task.priority] || 0);
  return { label: closed ? task.status.toUpperCase() : label, base, score };
}

/** Attaches urgency + score, then sorts hottest first.
    ponytail: scores in JS over the whole result set. Fine into the low
    thousands of tasks; push it into SQL if a single user ever passes that. */
export function rank(tasks, now = new Date()) {
  return tasks
    .map(t => ({ ...t, ...attention(t, now) }))
    .sort((a, b) => b.score - a.score || new Date(a.created_at) - new Date(b.created_at));
}
