import { useEffect, useState } from 'react';
import { api } from '../api.js';

const toLocal = iso => {
  if (!iso) return '';
  const d = new Date(iso), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocal = v => (v ? new Date(v).toISOString() : null);

/* The task form. Opens on Add with whatever was typed already in the title, so
   capture is never interrupted - filling the rest is optional, Save alone is a
   complete action. The same modal reopens from the row's info button, and its
   own footer is where the user chooses which fields it shows. */
export default function TaskModal({ task, buckets, fields, visible, onClose, onSaved, onSaveFields }) {
  const isNew = !task.id;
  const [draft, setDraft] = useState(task);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(visible);

  useEffect(() => { setDraft(task); }, [task]);
  useEffect(() => { setPicked(visible); }, [visible]);
  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const shown = fields.filter(f => visible.includes(f.key));

  const submit = async e => {
    e.preventDefault();
    if (!String(draft.title || '').trim()) { setError('Title chahiye'); return; }
    setBusy(true); setError('');
    const body = { title: draft.title.trim() };
    for (const f of shown) body[f.key] = draft[f.key] ?? null;
    try {
      if (isNew) await api.post('/tasks', body);
      else await api.patch(`/tasks/${task.id}`, body);
      onSaved(); onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`"${task.title}" delete karna hai? Wapas nahi aayega.`)) return;
    try { await api.del(`/tasks/${task.id}`); onSaved(); onClose(); }
    catch (err) { setError(err.message); }
  };

  const saveFields = async () => {
    try { await onSaveFields(picked); setPicking(false); }
    catch (err) { setError(err.message); }
  };

  const field = f => {
    const v = draft[f.key];
    switch (f.type) {
      case 'textarea':
        return <textarea value={v || ''} onChange={e => set(f.key, e.target.value)} />;
      case 'bool':
        return <label className="boolrow"><input type="checkbox" checked={!!v}
                 onChange={e => set(f.key, e.target.checked)} /> {f.label}</label>;
      case 'number':
        return <input type="number" step="any" value={v ?? ''} onChange={e => set(f.key, e.target.value)} />;
      case 'datetime':
        return <input type="datetime-local" value={toLocal(v)} onChange={e => set(f.key, fromLocal(e.target.value))} />;
      case 'bucket':
        return (
          <select value={v || ''} onChange={e => set(f.key, e.target.value || null)}>
            <option value="">Bina bucket</option>
            {buckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        );
      case 'enum':
        return (
          <select value={v || ''} onChange={e => set(f.key, e.target.value || null)}>
            {!f.required && <option value="">—</option>}
            {f.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      default:
        return <input value={v || ''} onChange={e => set(f.key, e.target.value)} />;
    }
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="tmodal" role="dialog" aria-label={isNew ? 'New task' : 'Edit task'}>
        <header>
          <h2>{picking ? 'Modal customise karo' : isNew ? 'Naya task' : 'Task'}</h2>
          <button className="dclose" onClick={onClose} aria-label="Close">&times;</button>
        </header>

        {error && <div className="err">{error}</div>}

        {picking ? (
          <>
            <div className="tmbody">
              <p className="muted" style={{ margin: '0 0 12px' }}>
                Jo fields chahiye wahi tick karo. <strong>Title hamesha rahega</strong> — usse hata nahi sakte.
              </p>
              <div className="fieldpick">
                {fields.map(f => (
                  <label key={f.key}>
                    <input type="checkbox" checked={picked.includes(f.key)}
                           onChange={e => setPicked(p => e.target.checked ? [...p, f.key] : p.filter(k => k !== f.key))} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <footer>
              <button className="btn primary" onClick={saveFields}>Save fields</button>
              <button className="btn" onClick={() => { setPicked(visible); setPicking(false); }}>Cancel</button>
              <span className="grow" />
              <span className="muted">{picked.length} fields</span>
            </footer>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="tmbody">
              <div className="field">
                <label htmlFor="tm-title">TITLE <em>required</em></label>
                <input id="tm-title" autoFocus={isNew} required value={draft.title || ''}
                       onChange={e => set('title', e.target.value)} />
              </div>
              {shown.map(f => (
                <div className="field" key={f.key}>
                  {f.type !== 'bool' && <label>{f.label.toUpperCase()}</label>}
                  {field(f)}
                </div>
              ))}
              {!shown.length && <p className="muted">Sirf title dikh raha hai. Neeche se aur fields chuno.</p>}
            </div>
            <footer>
              <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              {!isNew && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
              <span className="grow" />
              <button type="button" className="btn ghostbtn" onClick={() => setPicking(true)}>Edit modal</button>
            </footer>
          </form>
        )}
      </div>
    </>
  );
}
