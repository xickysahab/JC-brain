import { Router } from 'express';
import { one, many } from '../../shared/db.js';
import { hash, badPassword } from '../../shared/auth.js';

const r = Router();

/* The admin manages accounts, not content. There is deliberately no route here
   that reads another user's tasks - data stays with its owner. */

r.get('/users', async (req, res) => {
  const users = await many(
    `select u.id, u.email, u.name, u.role, u.is_active, u.created_at,
            (select count(*) from tasks t where t.user_id = u.id) as task_count
       from users u where u.account_id = $1 order by u.created_at`,
    [req.user.account_id]
  );
  res.json({ users });
});

r.post('/users', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim() || null;
  const password = String(req.body?.password || '');
  const role = req.body?.role === 'admin' ? 'admin' : 'client';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'That email does not look right' });
  const bad = badPassword(password);
  if (bad) return res.status(400).json({ error: bad });

  if (await one('select id from users where lower(email) = $1', [email]))
    return res.status(409).json({ error: 'A user with that email already exists' });

  const user = await one(
    `insert into users (account_id, email, name, password_hash, role)
     values ($1,$2,$3,$4,$5) returning id, email, name, role, is_active, created_at`,
    [req.user.account_id, email, name, await hash(password), role]
  );
  res.status(201).json({ user });
});

r.post('/users/:id/password', async (req, res) => {
  const password = String(req.body?.password || '');
  const bad = badPassword(password);
  if (bad) return res.status(400).json({ error: bad });

  const user = await one(
    'update users set password_hash = $3 where id = $2 and account_id = $1 returning id, email',
    [req.user.account_id, req.params.id, await hash(password)]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true, user });
});

r.patch('/users/:id', async (req, res) => {
  if (typeof req.body?.is_active !== 'boolean') return res.status(400).json({ error: 'Nothing to update' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account' });

  const user = await one(
    `update users set is_active = $3 where id = $2 and account_id = $1
     returning id, email, name, role, is_active, created_at`,
    [req.user.account_id, req.params.id, req.body.is_active]
  );
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

export default r;
