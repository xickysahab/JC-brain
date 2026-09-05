import { Router } from 'express';
import { one } from '../../shared/db.js';
import { sanitize, defaultLayout, BREAKPOINTS } from './layout.js';

const r = Router();

const bp = req => {
  const v = String(req.query.breakpoint || req.body?.breakpoint || 'desktop');
  return BREAKPOINTS.includes(v) ? v : null;
};

/* A user who has never arranged anything gets the default layout rather than an
   empty canvas - nobody starts designing from a blank page. isDefault tells the
   client this is a suggestion, not something the user saved. */
r.get('/', async (req, res) => {
  const breakpoint = bp(req);
  if (!breakpoint) return res.status(400).json({ error: 'Unknown breakpoint' });

  const row = await one(
    'select widgets, updated_at from dashboard_layouts where user_id = $1 and breakpoint = $2',
    [req.user.id, breakpoint]
  );
  if (!row) return res.json({ breakpoint, widgets: defaultLayout(breakpoint), isDefault: true });

  // Re-sanitize on read: a layout saved before a widget type was retired should
  // still open, minus the widget that no longer exists.
  const { widgets } = sanitize(row.widgets);
  res.json({ breakpoint, widgets, isDefault: false, updated_at: row.updated_at });
});

r.put('/', async (req, res) => {
  const breakpoint = bp(req);
  if (!breakpoint) return res.status(400).json({ error: 'Unknown breakpoint' });

  const { widgets, errors } = sanitize(req.body?.widgets);
  if (errors.length) return res.status(400).json({ error: errors[0] });

  const row = await one(
    `insert into dashboard_layouts (user_id, breakpoint, widgets)
     values ($1, $2, $3::jsonb)
     on conflict (user_id, breakpoint)
     do update set widgets = excluded.widgets, updated_at = now()
     returning widgets, updated_at`,
    [req.user.id, breakpoint, JSON.stringify(widgets)]
  );
  res.json({ breakpoint, widgets: row.widgets, isDefault: false, updated_at: row.updated_at });
});

/** Reset: forget what the user saved and fall back to the default. */
r.delete('/', async (req, res) => {
  const breakpoint = bp(req);
  if (!breakpoint) return res.status(400).json({ error: 'Unknown breakpoint' });

  await one('delete from dashboard_layouts where user_id = $1 and breakpoint = $2 returning id',
    [req.user.id, breakpoint]);
  res.json({ breakpoint, widgets: defaultLayout(breakpoint), isDefault: true });
});

export default r;
