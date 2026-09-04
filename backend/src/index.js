import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { parseOrigins, isAllowed } from './allowed-origin.js';
import { requireAuth, requireAdmin } from './auth.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import calendarRoutes from './routes/calendar.js';
import adminRoutes from './routes/admin.js';
import dashboardRoutes from './routes/dashboard.js';
import statsRoutes from './routes/stats.js';

const app = express();

// Render terminates TLS in front of the app; without this Express thinks the
// request is http and refuses to set the Secure session cookie.
app.set('trust proxy', 1);

/* Origins allowed to call this API with credentials. Trailing slashes are
   trimmed because "https://app.vercel.app/" and "https://app.vercel.app" are
   the same origin to a browser but not to a string compare. */
const origins = parseOrigins(process.env.CORS_ORIGINS);

app.use(cors({
  credentials: true,
  origin(origin, cb) {
    // An unlisted origin gets no CORS headers, and the browser enforces the
    // rest. Never reject the request itself: calls proxied through the
    // frontend's own domain are same-origin to the browser, and a server-side
    // 403 here would break them no matter what the allowlist says.
    cb(null, isAllowed(origin, origins));
  }
}));

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/calendar', requireAuth, calendarRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/stats', requireAuth, statsRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Never leak a stack trace to the browser; log it here instead.
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API on http://localhost:${port}`));
