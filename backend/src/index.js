import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { requireAuth, requireAdmin } from './auth.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import calendarRoutes from './routes/calendar.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Render terminates TLS in front of the app; without this Express thinks the
// request is http and refuses to set the Secure session cookie.
app.set('trust proxy', 1);

/* Only the origins listed in CORS_ORIGINS may call this API with credentials.
   Leave it empty when the frontend proxies /api through its own domain - then
   nothing is cross-origin and no allowlist is needed. */
const origins = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

if (origins.length) {
  app.use(cors({
    credentials: true,
    origin(origin, cb) {
      if (!origin || origins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} is not allowed`));
    }
  }));
}

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/calendar', requireAuth, calendarRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Never leak a stack trace to the browser; log it here instead.
app.use((err, req, res, _next) => {
  console.error(err);
  if (err?.message?.startsWith('Origin ')) return res.status(403).json({ error: 'Origin not allowed' });
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
