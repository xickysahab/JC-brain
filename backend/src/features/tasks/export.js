/* Taking your data out.

   Not a feature anyone demos, but a to-do app that cannot hand back what you
   typed is a to-do app you cannot leave - and that is a reason not to start. */

import { FIELDS } from './fields.js';

/* Everything the user can see on a task, in the order the form shows it.
   Derived from the catalogue, so a new field exports itself. */
export const COLUMNS = [
  'title',
  ...FIELDS.map(f => (f.key === 'bucket_id' ? 'bucket' : f.key)),
  'created_at', 'updated_at', 'completed_at'
];

/* A leading =, +, - or @ makes a spreadsheet treat the cell as a formula, so a
   task called "=cmd|..." becomes an attack the moment the file is opened
   somewhere else. Quoting does not stop it; a leading apostrophe does. */
const defuse = s => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const cell = v => {
  if (v == null) return '';
  // pg hands back timestamps as Date objects. Through JSON.stringify those
  // arrive already wrapped in quotes, which the escaper then doubles - so the
  // date has to be spelled out before the object branch, not after.
  const raw = v instanceof Date ? v.toISOString()
            : typeof v === 'object' ? JSON.stringify(v)
            : String(v);
  const s = defuse(raw);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV. CRLF line endings, because Excel still wants them. */
export function toCsv(rows, columns = COLUMNS) {
  return [columns.join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\r\n');
}

export const filename = (ext, now = new Date()) =>
  `jc-tasks-${now.toISOString().slice(0, 10)}.${ext}`;
