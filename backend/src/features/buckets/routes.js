import { Router } from 'express';
import { one, many } from '../../shared/db.js';

const r = Router();
const MAX = 40;

const clean = v => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);

r.get('/', async (req, res) => {
  const buckets = await many(
    `select b.id, b.name, b.color, b.position,
            count(t.id) filter (where t.status in ('Todo','In Progress')) as open_count,
            count(t.id) as task_count
       from buckets b
       left join tasks t on t.bucket_id = b.id
      where b.user_id = $1
      group by b.id
      order by b.position, lower(b.name)`,
    [req.user.id]
  );
  const [{ loose }] = await many(
    `select count(*) as loose from tasks
      where user_id = $1 and bucket_id is null and status in ('Todo','In Progress')`,
    [req.user.id]
  );
  res.json({ buckets, unbucketed: Number(loose) });
});

r.post('/', async (req, res) => {
  const name = clean(req.body?.name);
  if (!name) return res.status(400).json({ error: 'A bucket name is required' });

  const count = await one('select count(*)::int as n from buckets where user_id = $1', [req.user.id]);
  if (count.n >= MAX) return res.status(400).json({ error: `You can have at most ${MAX} buckets` });

  // Case-insensitive uniqueness, so "Sales" and "sales" cannot both exist.
  if (await one('select id from buckets where user_id = $1 and lower(name) = lower($2)', [req.user.id, name]))
    return res.status(409).json({ error: `A bucket called "${name}" already exists` });

  const bucket = await one(
    `insert into buckets (user_id, account_id, name, color, position)
     values ($1, $2, $3, $4, $5) returning id, name, color, position`,
    [req.user.id, req.user.account_id, name, Number(req.body?.color) || 0, count.n]
  );
  res.status(201).json({ bucket: { ...bucket, open_count: '0', task_count: '0' } });
});

r.patch('/:id', async (req, res) => {
  const set = {};
  if ('name' in req.body) {
    const name = clean(req.body.name);
    if (!name) return res.status(400).json({ error: 'A bucket name is required' });
    const clash = await one(
      'select id from buckets where user_id = $1 and lower(name) = lower($2) and id <> $3',
      [req.user.id, name, req.params.id]
    );
    if (clash) return res.status(409).json({ error: `A bucket called "${name}" already exists` });
    set.name = name;
  }
  if ('color' in req.body) set.color = Math.max(0, Math.min(7, Number(req.body.color) || 0));
  if ('position' in req.body) set.position = Math.max(0, Math.min(999, Number(req.body.position) || 0));
  if (!Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });

  const keys = Object.keys(set);
  const bucket = await one(
    `update buckets set ${keys.map((k, i) => `${k} = $${i + 3}`).join(', ')}
      where id = $2 and user_id = $1 returning id, name, color, position`,
    [req.user.id, req.params.id, ...keys.map(k => set[k])]
  );
  if (!bucket) return res.status(404).json({ error: 'Bucket not found' });
  res.json({ bucket });
});

/* Tasks are not deleted with their bucket - the foreign key is ON DELETE SET
   NULL, so they simply become un-bucketed and show up in triage again. */
r.delete('/:id', async (req, res) => {
  const row = await one('delete from buckets where id = $2 and user_id = $1 returning id', [req.user.id, req.params.id]);
  if (!row) return res.status(404).json({ error: 'Bucket not found' });
  res.json({ ok: true });
});

export default r;
