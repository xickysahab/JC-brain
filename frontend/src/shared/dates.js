/* Local-time date helpers. Everything the calendar shows is in the viewer's
   own timezone; the API stores UTC and converts at the edges. */

export const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addMonths = (d, n) => { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; };

/** Monday-start, matching the score engine's idea of a week. */
export const startOfWeek = d => addDays(startOfDay(d), -(((new Date(d).getDay() + 6) % 7)));
export const startOfMonth = d => { const x = startOfDay(d); x.setDate(1); return x; };

/** Top-left cell of a 6x7 month grid. */
export const monthGridStart = d => startOfWeek(startOfMonth(d));

export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const isToday = d => sameDay(d, new Date());

export const fmtTime = d => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
export const fmtRange = (a, b) => `${fmtTime(a)} – ${fmtTime(b)}`;

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Value for <input type="datetime-local">. */
export const toLocalInput = iso => {
  if (!iso) return '';
  const d = new Date(iso), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = v => (v ? new Date(v).toISOString() : null);

/** Hours as a float, e.g. 14:30 -> 14.5. Used to place events in a time grid. */
export const hourOf = d => { const x = new Date(d); return x.getHours() + x.getMinutes() / 60; };

/** Side-by-side lanes for events that overlap in time, so one never hides
    another. Returns [{ ...event, lane, lanes }]. */
export function layOut(events) {
  const sorted = [...events].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const out = [];
  let group = [], groupEnd = 0;

  const flush = () => {
    group.forEach(e => { e.lanes = group.reduce((m, x) => Math.max(m, x.lane + 1), 0); });
    out.push(...group); group = [];
  };

  for (const ev of sorted) {
    const start = new Date(ev.start_at).getTime(), end = new Date(ev.end_at).getTime();
    if (group.length && start >= groupEnd) flush();
    const taken = new Set(group.filter(g => new Date(g.end_at).getTime() > start).map(g => g.lane));
    let lane = 0; while (taken.has(lane)) lane++;
    group.push({ ...ev, lane });
    groupEnd = Math.max(groupEnd || 0, end);
  }
  if (group.length) flush();
  return out;
}
