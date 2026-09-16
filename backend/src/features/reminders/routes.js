import { Router } from 'express';
import { one } from '../../shared/db.js';
import { publicKey, pushConfigured, deliver } from './send.js';

const r = Router();

/** The browser needs this to subscribe; it is public by design. */
r.get('/key', (req, res) => res.json({ key: publicKey(), enabled: pushConfigured }));

r.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ error: 'That is not a valid push subscription' });

  // The endpoint is unique per browser, so re-enabling just moves it to this user.
  await one(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
     values ($1,$2,$3,$4)
     on conflict (endpoint) do update set user_id = excluded.user_id,
       p256dh = excluded.p256dh, auth = excluded.auth
     returning id`,
    [req.user.id, endpoint, keys.p256dh, keys.auth]
  );
  res.status(201).json({ ok: true });
});

r.delete('/subscribe', async (req, res) => {
  await one('delete from push_subscriptions where user_id = $1 and endpoint = $2 returning id',
            [req.user.id, String(req.body?.endpoint || '')]);
  res.json({ ok: true });
});

/** Proves the whole chain works before anyone waits on a real deadline. */
r.post('/test', async (req, res) => {
  const out = await deliver(req.user.id, {
    title: 'Reminders are on', body: 'This is what a task reminder will look like.', url: '/todo'
  });
  res.json(out);
});

export default r;
