import { Router } from 'express';
import { one } from '../../shared/db.js';
import { FIELDS, ALWAYS, DEFAULT_VISIBLE, sanitizeVisible } from './fields.js';

const r = Router();

/* The task modal's shape. `fields` is the catalogue the picker renders;
   `visible` is what this user chose to see. */
r.get('/task-fields', async (req, res) => {
  const row = await one('select task_fields from users where id = $1', [req.user.id]);
  res.json({
    fields: FIELDS.map(({ key, label, type, options, required }) => ({ key, label, type, options, required })),
    always: ALWAYS,
    visible: row?.task_fields ? sanitizeVisible(row.task_fields) : DEFAULT_VISIBLE
  });
});

r.put('/task-fields', async (req, res) => {
  const visible = sanitizeVisible(req.body?.visible);
  await one('update users set task_fields = $2::jsonb where id = $1 returning id',
    [req.user.id, JSON.stringify(visible)]);
  res.json({ visible });
});

export default r;
