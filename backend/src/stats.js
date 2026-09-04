/* Aggregation behind every chart widget. Pure functions so the grouping rules
   can be tested without a database, and so the client and the API agree on
   what "group by owner" means. */

import { attention, endOfWeek } from './score.js';

const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayKey = d => {
  const x = new Date(d), p = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

/** Every dimension a chart can group by. `of` returns the bucket for one task;
    `order` fixes the slice order so a pie does not reshuffle on every reload. */
export const GROUPS = {
  status:   { label: 'Status',   order: ['Todo', 'In Progress', 'Done', 'Cancelled'], of: t => t.status },
  priority: { label: 'Priority', order: ['SOS', 'High', 'Medium', 'Low', 'None'],     of: t => t.priority || 'None' },
  urgency:  { label: 'Urgency',
              order: ['OVERDUE', 'DUE TODAY', 'DUE SOON', 'SOS', 'TOMORROW', 'THIS WEEK', 'STALE', 'LATER', 'UNSCHEDULED'],
              of: (t, now) => attention(t, now).label },
  due:      { label: 'Due when',  order: ['Overdue', 'Today', 'This week', 'Later', 'No date'],
              of: (t, now) => {
                if (!t.deadline) return 'No date';
                const d = new Date(t.deadline);
                if (d < now) return 'Overdue';
                if (startOfDay(d) <= startOfDay(now)) return 'Today';
                return d <= endOfWeek(now) ? 'This week' : 'Later';
              } },
  owner:    { label: 'Owner',    of: t => t.owner || 'Unassigned' },
  client:   { label: 'Client',   of: t => t.client || 'No client' },
  bucket:   { label: 'Bucket',   of: t => t.bucket || 'No bucket' },
  project:  { label: 'Project',  of: t => t.project || 'No project' },
  created:  { label: 'Created on',  date: true, of: t => dayKey(t.created_at) },
  deadline: { label: 'Deadline on', date: true, of: t => (t.deadline ? dayKey(t.deadline) : null) }
};

export const SCOPES = {
  open: { label: 'Open only', keep: t => t.status === 'Todo' || t.status === 'In Progress' },
  done: { label: 'Done only', keep: t => t.status === 'Done' },
  all:  { label: 'All tasks', keep: () => true }
};

export const RANGES = {
  all:        { label: 'All time',   days: null },
  last_7:     { label: 'Last 7 days',  days: 7 },
  last_30:    { label: 'Last 30 days', days: 30 },
  this_month: { label: 'This month',   days: null, monthToDate: true }
};

export const METRICS = { count: { label: 'Task count' } };

// "category" was this dimension's name before buckets replaced it; saved chart
// configs still carry it, so it keeps working.
const ALIASES = { category: 'bucket' };
export const resolveGroup = g => (Object.hasOwn(GROUPS, g) ? g : ALIASES[g]);
export const isGroup = g => !!resolveGroup(g);
export const isScope = s => Object.hasOwn(SCOPES, s);
export const isRange = r => Object.hasOwn(RANGES, r);

/** Groups tasks into { groups: [{ key, label, value }], total }.
    ponytail: grouping happens in JS over the user's tasks rather than in SQL,
    which keeps one code path for every dimension including the computed ones.
    Push it into SQL if a single user ever holds tens of thousands of tasks. */
export function summarize(tasks, opts = {}, now = new Date()) {
  const groupBy = resolveGroup(opts.groupBy) || 'status';
  const scope = isScope(opts.scope) ? opts.scope : 'open';
  const range = isRange(opts.range) ? opts.range : 'all';
  const g = GROUPS[groupBy];

  let from = null;
  if (RANGES[range].days) from = startOfDay(new Date(now.getTime() - RANGES[range].days * 86400000));
  else if (RANGES[range].monthToDate) from = new Date(now.getFullYear(), now.getMonth(), 1);

  const counts = new Map();
  let total = 0;
  for (const t of tasks) {
    if (!SCOPES[scope].keep(t)) continue;
    if (from && new Date(t.created_at) < from) continue;
    const key = g.of(t, now);
    if (key == null) continue;             // e.g. no deadline when grouping by deadline
    counts.set(key, (counts.get(key) || 0) + 1);
    total++;
  }

  // A fixed order for known buckets; dates ascending; everything else by size,
  // so the biggest slice is always first and ties break by name.
  let keys = [...counts.keys()];
  if (g.order) keys.sort((a, b) => g.order.indexOf(a) - g.order.indexOf(b));
  else if (g.date) keys.sort();
  else keys.sort((a, b) => counts.get(b) - counts.get(a) || String(a).localeCompare(String(b)));

  return { groupBy, scope, range, total, groups: keys.map(k => ({ key: k, label: k, value: counts.get(k) })) };
}
