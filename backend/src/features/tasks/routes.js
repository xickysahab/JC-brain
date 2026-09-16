import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { one, many } from '../../shared/db.js';
import { rank, endOfWeek } from '../../shared/score.js';
import { FIELDS, fieldDef } from './fields.js';
import { nextInstance } from './recurrence.js';
import { toCsv, COLUMNS, filename } from './export.js';

const r = Router();

/* The writable set comes straight from the field catalogue, so a field added
   there is accepted here without a second edit - and one removed there stops
   being writable everywhere at once. */
const WRITABLE = new Map(FIELDS.map(f => [f.key, f.type]));

/* Whitelist-based patch builder. Everything the client sends that is not on
   this list is dropped, so a stray field can never reach the UPDATE. */
function buildPatch(body) {
  const set = {}, errors = [];

  if ('title' in body) {
    const title = String(body.title ?? '').slice(0, 500);
    if (!title.trim()) errors.push('Title cannot be empty');
    else set.title = title;
  }

  for (const [key, type] of WRITABLE) {
    if (!(key in body)) continue;
    const v = body[key];
    const blank = v == null || v === '';

    switch (type) {
      case 'text': case 'textarea':
        set[key] = blank ? null : String(v).slice(0, 4000);
        break;
      case 'bool':
        set[key] = v === true || v === 'true';
        break;
      case 'number': {
        if (blank) { set[key] = null; break; }
        const n = Number(v);
        if (!Number.isFinite(n)) errors.push(`${key} must be a number`); else set[key] = n;
        break;
      }
      case 'datetime': {
        if (blank) { set[key] = null; break; }
        const d = new Date(v);
        if (isNaN(d)) errors.push(`${key} is not a valid date`); else set[key] = d.toISOString();
        break;
      }
      case 'enum': {
        const def = fieldDef(key);
        if (blank) {
          if (def.required) errors.push(`${key} cannot be empty`); else set[key] = null;
        } else if (!def.options.includes(v)) errors.push(`Unknown ${key}`);
        else set[key] = v;
        break;
      }
      case 'checklist': {
        // A checklist is stored whole, so it is also validated whole: anything
        // that is not a titled step is dropped rather than half-written.
        const items = (Array.isArray(v) ? v : [])
          .map(s => ({ id: String(s?.id || '').slice(0, 40) || randomUUID(),
                       title: String(s?.title ?? '').trim().slice(0, 300),
                       done: s?.done === true }))
          .filter(s => s.title)
          .slice(0, 100);
        set[key] = JSON.stringify(items);
        break;
      }
      case 'bucket':
        // Format only here; ownership is checked against the caller below.
        if (blank) set.bucket_id = null;
        else if (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)) set.bucket_id = v;
        else errors.push('bucket_id is not valid');
        break;
    }
  }

  // Completing a task stamps the time; reopening clears it.
  if ('status' in set) set.completed_at = set.status === 'Done' ? new Date().toISOString() : null;

  return { set, errors };
}

/* Every query is scoped by user_id. The admin has no read path into another
   user's tasks - that was the explicit product decision, not an oversight. */
const SELECT = `select t.*, b.name as bucket
                  from tasks t left join buckets b on b.id = t.bucket_id`;
const scoped = 'where t.user_id = $1';

/* A bucket id from the client is only a shape until this says it belongs to
   the caller - otherwise one user could file their task under another's. */
const ownsBucket = async (userId, id) =>
  !id || !!(await one('select 1 from buckets where id = $1 and user_id = $2', [id, userId]));

r.get('/', async (req, res) => {
  const view = String(req.query.view || 'open');
  const search = String(req.query.q || '').trim();
  const params = [req.user.id];
  let sql = `${SELECT} ${scoped}`;

  if (search) { params.push(`%${search}%`);
    sql += ` and (t.title ilike $${params.length} or t.description ilike $${params.length}
                  or t.client ilike $${params.length} or t.owner ilike $${params.length}
                  or b.name ilike $${params.length} or t.project ilike $${params.length})`; }

  if (view === 'open')          sql += ` and t.status in ('Todo','In Progress')`;
  else if (view === 'todo')     sql += ` and t.status = 'Todo'`;
  else if (view === 'progress') sql += ` and t.status = 'In Progress'`;
  else if (view === 'done')     sql += ` and t.status in ('Done','Cancelled')`;
  else if (view === 'sos')      sql += ` and t.priority = 'SOS' and t.status in ('Todo','In Progress')`;
  else if (view === 'overdue')  sql += ` and t.deadline < now() and t.status in ('Todo','In Progress')`;
  else if (view === 'today')    sql += ` and t.deadline < $${params.push(endOfDay())} and t.status in ('Todo','In Progress')`;
  else if (view === 'unbucketed') sql += ` and t.bucket_id is null and t.status in ('Todo','In Progress')`;
  else if (view === 'week')     sql += ` and t.deadline <= $${params.push(endOfWeek(new Date()).toISOString())} and t.status in ('Todo','In Progress')`;

  const rows = await many(sql, params);
  res.json({ tasks: view === 'done' ? rows.sort(byRecent) : rank(rows) });
});

function endOfDay() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString(); }
const byRecent = (a, b) => new Date(b.completed_at || b.updated_at) - new Date(a.completed_at || a.updated_at);

r.get('/counts', async (req, res) => {
  const rows = await many(
    `select t.status, t.priority, t.deadline, t.bucket_id from tasks t ${scoped}
        and t.status in ('Todo','In Progress')`,
    [req.user.id]
  );
  const now = new Date(), eod = new Date(endOfDay());
  res.json({
    open: rows.length,
    sos: rows.filter(t => t.priority === 'SOS').length,
    overdue: rows.filter(t => t.deadline && new Date(t.deadline) < now).length,
    today: rows.filter(t => t.deadline && new Date(t.deadline) <= eod).length,
    unbucketed: rows.filter(t => !t.bucket_id).length
  });
});

/* Finishing a repeating task leaves the next copy behind. It runs on the
   transition into Done, never on a task that was already Done - otherwise
   re-saving a finished task would breed copies of it. */
async function spawnNext(user, task, now = new Date()) {
  if (task.status !== 'Done' || task.prev_status === 'Done' || !task.repeat) return null;
  const row = nextInstance(task, now);
  if (!row) return null;
  if (Array.isArray(row.subtasks)) row.subtasks = JSON.stringify(row.subtasks);

  const cols = ['user_id', 'account_id', ...Object.keys(row)];
  const vals = [user.id, user.account_id, ...Object.values(row)];
  return one(`insert into tasks (${cols.join(',')}) values (${vals.map((_, i) => '$' + (i + 1))}) returning *`, vals);
}

/* Every task this user has, in a file they can open anywhere. Scoped by
   user_id like everything else, so an export is only ever your own. */
r.get('/export', async (req, res) => {
  const json = String(req.query.format || 'csv').toLowerCase() === 'json';
  const rows = await many(`${SELECT} ${scoped} order by t.created_at`, [req.user.id]);

  res.setHeader('Content-Disposition', `attachment; filename="${filename(json ? 'json' : 'csv')}"`);
  if (json) return res.type('application/json').send(JSON.stringify({ exported_at: new Date().toISOString(), tasks: rows }, null, 2));

  // The BOM is what stops Excel reading a name with an accent as mojibake.
  res.type('text/csv; charset=utf-8').send('\uFEFF' + toCsv(rows, COLUMNS));
});

r.post('/', async (req, res) => {
  const { set, errors } = buildPatch(req.body || {});
  if (!set.title?.trim()) errors.push('Title is required');
  if (errors.length) return res.status(400).json({ error: errors[0] });
  if (!await ownsBucket(req.user.id, set.bucket_id)) return res.status(400).json({ error: 'Unknown bucket' });

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
  if (!await ownsBucket(req.user.id, set.bucket_id)) return res.status(400).json({ error: 'Unknown bucket' });

  const keys = Object.keys(set);
  const assigns = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  // prev_status rides along so the write knows whether this is the moment the
  // task was finished, which is the only moment a repeat should fire.
  const task = await one(
    `with prev as (select status from tasks where id = $2 and user_id = $1)
     update tasks set ${assigns}, updated_at = now() where id = $2 and user_id = $1
     returning *, (select status from prev) as prev_status`,
    [req.user.id, req.params.id, ...keys.map(k => set[k])]
  );
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const spawned = await spawnNext(req.user, task);
  delete task.prev_status;
  res.json({ task, spawned });
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
  if (!await ownsBucket(req.user.id, set.bucket_id)) return res.status(400).json({ error: 'Unknown bucket' });

  const keys = Object.keys(set);
  const assigns = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const rows = await many(
    `with prev as (select id, status from tasks where user_id = $1 and id = any($2::uuid[]))
     update tasks set ${assigns}, updated_at = now() where user_id = $1 and id = any($2::uuid[])
     returning tasks.*, (select status from prev where prev.id = tasks.id) as prev_status`,
    [req.user.id, ids, ...keys.map(k => set[k])]
  );
  // Marking twenty repeating tasks done in one go has to leave twenty copies.
  const spawned = (await Promise.all(rows.map(t => spawnNext(req.user, t)))).filter(Boolean);
  res.json({ changed: rows.length, spawned: spawned.length });
});

export default r;
