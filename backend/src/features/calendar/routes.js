import { Router } from 'express';
import { one, many } from '../../shared/db.js';

const r = Router();

/* One call fills a calendar screen: the user's own events plus the task
   deadlines that fall in the same window. Two separate round trips for a
   single grid was not worth it. */
r.get('/', async (req, res) => {
  const from = new Date(req.query.from), to = new Date(req.query.to);
  if (isNaN(from) || isNaN(to)) return res.status(400).json({ error: 'from and to must be dates' });
  if (to <= from) return res.status(400).json({ error: 'to must be after from' });
  if (to - from > 400 * 86400000) return res.status(400).json({ error: 'Range is too wide' });

  const [events, tasks] = await Promise.all([
    many(`select * from events
           where user_id = $1 and start_at < $3 and end_at > $2
           order by start_at`, [req.user.id, from, to]),
    many(`select id, title, deadline, start_date, bucket_id, priority, status, client
            from tasks
           where user_id = $1
             and status in ('Todo','In Progress')
             and (
               (start_date is not null and start_date < $3 and deadline > $2)
               or (start_date is null and deadline is not null and deadline >= $2 and deadline < $3)
               or (start_date is null and deadline is null)
             )
           order by deadline`, [req.user.id, from, to])
  ]);
  res.json({ events, tasks });
});

const TEXT = ['title', 'location', 'attendees', 'notes', 'bucket_id'];

/* Same whitelist approach as tasks: unknown keys never reach the SQL. */
function buildPatch(body, { requireTimes }) {
  const set = {}, errors = [];
  for (const k of TEXT) if (k in body) set[k] = body[k] == null ? null : String(body[k]).slice(0, 4000);
  for (const k of ['start_at', 'end_at']) if (k in body) {
    const d = new Date(body[k]);
    if (isNaN(d)) errors.push(`${k.replace('_at', '')} time is not valid`); else set[k] = d.toISOString();
  }
  if (requireTimes && (!set.start_at || !set.end_at)) errors.push('Start and end times are required');
  if (set.start_at && set.end_at && new Date(set.end_at) <= new Date(set.start_at))
    errors.push('End time must be after the start time');
  if ('title' in set && !String(set.title || '').trim()) errors.push('Title cannot be empty');
  return { set, errors };
}

r.post('/events', async (req, res) => {
  const { set, errors } = buildPatch(req.body || {}, { requireTimes: true });
  if (!set.title?.trim()) errors.unshift('Title is required');
  if (errors.length) return res.status(400).json({ error: errors[0] });

  const cols = ['user_id', 'account_id', ...Object.keys(set)];
  const vals = [req.user.id, req.user.account_id, ...Object.values(set)];
  const event = await one(
    `insert into events (${cols.join(',')}) values (${vals.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, vals
  );
  res.status(201).json({ event });
});

r.patch('/events/:id', async (req, res) => {
  const { set, errors } = buildPatch(req.body || {}, { requireTimes: false });
  if (errors.length) return res.status(400).json({ error: errors[0] });
  if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });

  // A drag can move only the start; check the resulting pair, not just the patch.
  if (set.start_at || set.end_at) {
    const cur = await one('select start_at, end_at from events where id = $2 and user_id = $1', [req.user.id, req.params.id]);
    if (!cur) return res.status(404).json({ error: 'Event not found' });
    const start = new Date(set.start_at ?? cur.start_at), end = new Date(set.end_at ?? cur.end_at);
    if (end <= start) return res.status(400).json({ error: 'End time must be after the start time' });
  }

  const keys = Object.keys(set);
  const assigns = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const event = await one(
    `update events set ${assigns}, updated_at = now() where id = $2 and user_id = $1 returning *`,
    [req.user.id, req.params.id, ...keys.map(k => set[k])]
  );
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({ event });
});

r.delete('/events/:id', async (req, res) => {
  const row = await one('delete from events where id = $2 and user_id = $1 returning id', [req.user.id, req.params.id]);
  if (!row) return res.status(404).json({ error: 'Event not found' });
  res.json({ ok: true });
});

export default r;
