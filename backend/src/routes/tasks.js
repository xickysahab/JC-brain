import { Router } from 'express';
import { one, many } from '../db.js';
import { rank, endOfWeek } from '../score.js';

const r = Router();

const STATUS = ['Todo', 'In Progress', 'Done', 'Cancelled'];
const PRIORITY = ['SOS', 'High', 'Medium', 'Low'];
const TEXT = ['title', 'description', 'owner', 'client', 'category', 'project'];
const DATES = ['deadline', 'start_date'];

/* Whitelist-based patch builder. Everything the client sends that is not on
   this list is dropped, so a stray field can never reach the UPDATE. */
function buildPatch(body) {
  const set = {}, errors = [];
  for (const k of TEXT) if (k in body) set[k] = body[k] == null ? null : String(body[k]).slice(0, 4000);
  for (const k of DATES) if (k in body) {
    if (body[k] == null || body[k] === '') { set[k] = null; continue; }
    const d = new Date(body[k]);
    if (isNaN(d)) errors.push(`${k} is not a valid date`); else set[k] = d.toISOString();
  }
  if ('status' in body) {
    if (!STATUS.includes(body.status)) errors.push('Unknown status');
    else { set.status = body.status; set.completed_at = body.status === 'Done' ? new Date().toISOString() : null; }
  }
  if ('priority' in body) {
    if (body.priority == null || body.priority === '') set.priority = null;
    else if (!PRIORITY.includes(body.priority)) errors.push('Unknown priority');
    else set.priority = body.priority;
  }
  if (set.title != null && !set.title.trim()) errors.push('Title cannot be empty');
  return { set, errors };
}

/* Every query is scoped by user_id. The admin has no read path into another
   user's tasks - that was the explicit product decision, not an oversight. */
const scoped = 'where user_id = $1';

r.get('/', async (req, res) => {
  const view = String(req.query.view || 'open');
  const search = String(req.query.q || '').trim();
  const params = [req.user.id];
  let sql = `select * from tasks ${scoped}`;

  if (search) { params.push(`%${search}%`);
    sql += ` and (title ilike $${params.length} or description ilike $${params.length}
                  or client ilike $${params.length} or owner ilike $${params.length}
                  or category ilike $${params.length} or project ilike $${params.length})`; }

  if (view === 'open')          sql += ` and status in ('Todo','In Progress')`;
  else if (view === 'todo')     sql += ` and status = 'Todo'`;
  else if (view === 'progress') sql += ` and status = 'In Progress'`;
  else if (view === 'done')     sql += ` and status in ('Done','Cancelled')`;
  else if (view === 'sos')      sql += ` and priority = 'SOS' and status in ('Todo','In Progress')`;
  else if (view === 'overdue')  sql += ` and deadline < now() and status in ('Todo','In Progress')`;
  else if (view === 'today')    sql += ` and deadline < $${params.push(endOfDay()) } and status in ('Todo','In Progress')`;
  else if (view === 'week')     sql += ` and deadline <= $${params.push(endOfWeek(new Date()).toISOString())} and status in ('Todo','In Progress')`;

  const rows = await many(sql, params);
  res.json({ tasks: view === 'done' ? rows.sort(byRecent) : rank(rows) });
});

function endOfDay() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString(); }
const byRecent = (a, b) => new Date(b.completed_at || b.updated_at) - new Date(a.completed_at || a.updated_at);

r.get('/counts', async (req, res) => {
  const rows = await many(
    `select status, priority, deadline from tasks ${scoped} and status in ('Todo','In Progress')`,
    [req.user.id]
  );
  const now = new Date(), eod = new Date(endOfDay());
  res.json({
    open: rows.length,
    sos: rows.filter(t => t.priority === 'SOS').length,
    overdue: rows.filter(t => t.deadline && new Date(t.deadline) < now).length,
    today: rows.filter(t => t.deadline && new Date(t.deadline) <= eod).length
  });
});

r.post('/', async (req, res) => {
  const { set, errors } = buildPatch(req.body || {});
  if (!set.title?.trim()) errors.push('Title is required');
  if (errors.length) return res.status(400).json({ error: errors[0] });

  const cols = ['user_id', 'account_id', ...Object.keys(set)];
  const vals = [req.user.id, req.user.account_id, ...Object.values(set)];
  const task = await one(
    `insert into tasks (${cols.join(',')}) values (${vals.map((_, i) => '$' + (i + 1))}) returning *`, vals
  );
  res.status(201).json({ task });
});

r.patch('/:id', async (req, res) => {
  const { set, errors } = buildPatch(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors[0] });
  if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });

  const keys = Object.keys(set);
  const assigns = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const task = await one(
    `update tasks set ${assigns}, updated_at = now() where id = $2 and user_id = $1 returning *`,
    [req.user.id, req.params.id, ...keys.map(k => set[k])]
  );
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json({ task });
});

r.delete('/:id', async (req, res) => {
  const row = await one('delete from tasks where id = $2 and user_id = $1 returning id', [req.user.id, req.params.id]);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  res.json({ ok: true });
});

/* Bulk edit and bulk delete. The user_id filter is what stops one user's id
   list from touching another user's rows. */
r.post('/bulk', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 500) : [];
  if (!ids.length) return res.status(400).json({ error: 'No tasks selected' });

  if (req.body.action === 'delete') {
    const rows = await many('delete from tasks where user_id = $1 and id = any($2::uuid[]) returning id', [req.user.id, ids]);
    return res.json({ changed: rows.length });
  }
  const { set, errors } = buildPatch(req.body?.patch || {});
  if (errors.length) return res.status(400).json({ error: errors[0] });
  if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });

  const keys = Object.keys(set);
  const assigns = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const rows = await many(
    `update tasks set ${assigns}, updated_at = now() where user_id = $1 and id = any($2::uuid[]) returning id`,
    [req.user.id, ids, ...keys.map(k => set[k])]
  );
  res.json({ changed: rows.length });
});

export default r;
