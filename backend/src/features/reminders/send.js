import webpush from 'web-push';
import { many, one } from '../../shared/db.js';

/* Delivery. One function the rest of the app calls; which channels exist is
   this file's business alone, so adding email later changes nothing outside
   it. Push works with no third-party account - the keys are ours. */

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
export const pushConfigured = Boolean(PUBLIC && PRIVATE);

if (pushConfigured) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@jc-brain.app', PUBLIC, PRIVATE);
}
export const publicKey = () => PUBLIC || null;

/** Sends to every browser this user enabled, and forgets the ones that are
    gone - a 404 or 410 from the push service means that subscription is dead,
    and keeping it means retrying it forever. */
export async function deliver(userId, payload) {
  if (!pushConfigured) return { sent: 0, reason: 'push not configured' };

  const subs = await many(
    'select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1', [userId]
  );
  let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await one('delete from push_subscriptions where id = $1 returning id', [s.id]);
      } else {
        console.error('push failed', err.statusCode, err.body);
      }
    }
  }));
  return { sent, devices: subs.length };
}
