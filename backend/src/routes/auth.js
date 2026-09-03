import { Router } from 'express';
import { one } from '../db.js';
import { verify, issue, clear, requireAuth, hash, badPassword } from '../auth.js';

const r = Router();
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role });

r.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = await one('select * from users where lower(email) = $1', [email]);
  // Same message either way so the form cannot be used to discover valid emails.
  const ok = user && user.is_active && await verify(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email or password is wrong' });

  issue(res, user);
  res.json({ user: publicUser(user) });
});

r.post('/logout', (req, res) => { clear(res); res.json({ ok: true }); });

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

r.post('/password', requireAuth, async (req, res) => {
  const current = String(req.body?.current || '');
  const next = String(req.body?.next || '');
  const bad = badPassword(next);
  if (bad) return res.status(400).json({ error: bad });

  const row = await one('select password_hash from users where id = $1', [req.user.id]);
  if (!await verify(current, row.password_hash)) return res.status(401).json({ error: 'Current password is wrong' });

  await one('update users set password_hash = $2 where id = $1 returning id', [req.user.id, await hash(next)]);
  res.json({ ok: true });
});

export default r;
