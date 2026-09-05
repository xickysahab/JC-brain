/* One description of the task form, used by the API to whitelist writes and by
   the client to render the modal. Two lists would drift; this one cannot. */

export const FIELDS = [
  { key: 'description',       label: 'Description',    type: 'textarea' },
  { key: 'status',            label: 'Status',         type: 'enum', options: ['Todo', 'In Progress', 'Done', 'Cancelled'], required: true },
  { key: 'priority',          label: 'Priority',       type: 'enum', options: ['SOS', 'High', 'Medium', 'Low'] },
  { key: 'bucket_id',         label: 'Bucket',         type: 'bucket' },
  { key: 'deadline',          label: 'Deadline',       type: 'datetime' },
  { key: 'start_date',        label: 'Start date',     type: 'datetime' },
  { key: 'follow_up_date',    label: 'Follow-up date', type: 'datetime' },
  { key: 'owner',             label: 'Owner',          type: 'text' },
  { key: 'client',            label: 'Client',         type: 'text' },
  { key: 'project',           label: 'Project',        type: 'text' },
  { key: 'delegated',         label: 'Delegated',      type: 'bool' },
  { key: 'blocked',           label: 'Blocked',        type: 'bool' },
  { key: 'waiting_on',        label: 'Waiting on',     type: 'text' },
  { key: 'requires_thinking', label: 'Needs thinking', type: 'bool' },
  { key: 'pinned',            label: 'Pinned',         type: 'bool' },
  { key: 'revenue_impact',    label: 'Revenue impact', type: 'enum', options: ['Direct', 'Indirect', 'None'] },
  { key: 'revenue_value',     label: 'Revenue value',  type: 'number' }
];

/** Title is not in FIELDS: it is always shown and always required, so it is
    never something the user can switch off. */
export const ALWAYS = ['title'];

export const DEFAULT_VISIBLE = ['description', 'status', 'priority', 'bucket_id', 'deadline', 'owner'];

const BY_KEY = new Map(FIELDS.map(f => [f.key, f]));
export const fieldDef = key => BY_KEY.get(key);

/** Keeps the user's choice to real fields, in the canonical order, and never
    empty - an empty modal would be a dead end. */
export function sanitizeVisible(list) {
  if (!Array.isArray(list)) return DEFAULT_VISIBLE;
  const want = new Set(list.filter(k => BY_KEY.has(k)));
  const ordered = FIELDS.filter(f => want.has(f.key)).map(f => f.key);
  return ordered.length ? ordered : DEFAULT_VISIBLE;
}
