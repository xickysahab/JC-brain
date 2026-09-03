import { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUS = ['Todo', 'In Progress', 'Done', 'Cancelled'];
const PRIORITY = ['', 'SOS', 'High', 'Medium', 'Low'];
const CATEGORY = ['', 'Client', 'Sales', 'Finance', 'Team', 'Creative', 'Admin', 'Learning', 'Personal'];

const toLocal = iso => {
  if (!iso) return '';
  const d = new Date(iso), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocal = v => (v ? new Date(v).toISOString() : null);

/* Edits are sent field by field on blur/change rather than through a Save
   button, so a half-filled drawer can be closed without losing anything. */
export default function TaskDrawer({ task, onClose, onChanged }) {
  const [draft, setDraft] = useState(task);
  const [error, setError] = useState('');

  useEffect(() => setDraft(task), [task]);
  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const save = async patch => {
    setError('');
    try {
      const { task: updated } = await api.patch(`/tasks/${task.id}`, patch);
      setDraft(updated);
      onChanged();
    } catch (err) {
      setError(err.message);
      setDraft(task);           // put the old value back so the form never lies
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try { await api.del(`/tasks/${task.id}`); onClose(); onChanged(); }
    catch (err) { setError(err.message); }
  };

  const text = (field, label) => (
    <div className="field">
      <label>{label}</label>
      <input value={draft[field] || ''}
             onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
             onBlur={e => e.target.value !== (task[field] || '') && save({ [field]: e.target.value })} />
    </div>
  );
  const date = (field, label) => (
    <div className="field">
      <label>{label}</label>
      <input type="datetime-local" value={toLocal(draft[field])}
             onChange={e => save({ [field]: fromLocal(e.target.value) })} />
    </div>
  );
  const pick = (field, label, options) => (
    <div className="field">
      <label>{label}</label>
      <select value={draft[field] || ''} onChange={e => save({ [field]: e.target.value || null })}>
        {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </div>
  );

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Task detail">
        <button className="dclose" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{draft.title}</h2>
        {error && <div className="err">{error}</div>}

        {text('title', 'TITLE')}
        <div className="field">
          <label>DESCRIPTION</label>
          <textarea value={draft.description || ''}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    onBlur={e => e.target.value !== (task.description || '') && save({ description: e.target.value })} />
        </div>
        <div className="two">
          {pick('status', 'STATUS', STATUS)}
          {pick('priority', 'PRIORITY', PRIORITY)}
        </div>
        <div className="two">
          {date('deadline', 'DEADLINE')}
          {date('start_date', 'START DATE')}
        </div>
        <div className="two">
          {text('owner', 'OWNER')}
          {text('client', 'CLIENT')}
        </div>
        <div className="two">
          {pick('category', 'CATEGORY', CATEGORY)}
          {text('project', 'PROJECT')}
        </div>

        <div className="dacts">
          <button className="btn danger" onClick={remove}>Delete</button>
        </div>
        <div className="readout">
          created {new Date(draft.created_at).toLocaleString()}<br />
          updated {new Date(draft.updated_at).toLocaleString()}
          {draft.completed_at && <><br />completed {new Date(draft.completed_at).toLocaleString()}</>}
        </div>
      </aside>
    </>
  );
}
