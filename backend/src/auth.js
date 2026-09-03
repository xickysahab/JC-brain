import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { one } from './db.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and put a long random value in it.');
  process.exit(1);
}
const COOKIE = 'jc_session';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const hash = pw => bcrypt.hash(pw, 12);
export const verify = (pw, h) => bcrypt.compare(pw, h);

const isProd = process.env.NODE_ENV === 'production';

export function issue(res, user) {
  const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    // In production the API (Render) and the app (Vercel) are different hosts,
    // so the cookie has to be SameSite=None to travel at all - and None is only
    // honoured with Secure. Locally everything is one origin, so lax is fine.
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: MAX_AGE
  });
}
export const clear = res =>
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: isProd ? 'none' : 'lax', secure: isProd });

/* Loads the user on every request. Deactivated users lose access immediately
   rather than at token expiry, which is why this hits the DB each time. */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  let uid;
  try { ({ uid } = jwt.verify(token, SECRET)); }
  catch { clear(res); return res.status(401).json({ error: 'Session expired' }); }

  const user = await one(
    'select id, account_id, email, name, role, is_active from users where id = $1', [uid]
  );
  if (!user || !user.is_active) { clear(res); return res.status(401).json({ error: 'Account is not active' }); }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
}

/** Password rules live here so signup, admin-create and reset all agree. */
export function badPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  return null;
}
