import { Router } from 'express';
import { many } from '../db.js';
import { summarize, GROUPS, SCOPES, RANGES, METRICS } from '../stats.js';

const r = Router();

/** What the config panel offers. Served from the same module that does the
    grouping, so a new dimension shows up in the UI without a second edit. */
r.get('/options', (req, res) => {
  const list = (obj, extra = () => ({})) =>
    Object.entries(obj).map(([key, v]) => ({ key, label: v.label, ...extra(v) }));
  res.json({
    groupBy: list(GROUPS, v => ({ date: !!v.date })),
    scope: list(SCOPES),
    range: list(RANGES),
    metric: list(METRICS)
  });
});

r.get('/', async (req, res) => {
  const tasks = await many(
    `select status, priority, owner, client, category, project,
            deadline, created_at, updated_at
       from tasks where user_id = $1`,
    [req.user.id]
  );
  res.json(summarize(tasks, {
    groupBy: req.query.groupBy, scope: req.query.scope, range: req.query.range
  }));
});

export default r;
