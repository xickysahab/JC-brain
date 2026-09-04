import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { toLocalInput, fromLocalInput } from '../dates.js';
import DialogModal from './DialogModal.jsx';

/* Handles both a brand new draft and an existing event. Events have a start
   and an end that must agree, so this one saves on a button rather than
   per-field like the task drawer. */
export default function EventDrawer({ event, onClose, onChanged }) {
  const isNew = !event.id;
  const [draft, setDraft] = useState(event);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);

  useEffect(() => setDraft(event), [event]);
  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const save = async e => {
    e.preventDefault();
    setError(''); setBusy(true);
    const body = {
      title: draft.title, start_at: draft.start_at, end_at: draft.end_at,
      location: draft.location || null, attendees: draft.attendees || null, notes: draft.notes || null
    };
    try {
      if (isNew) await api.post('/calendar/events', body);
      else await api.patch(`/calendar/events/${event.id}`, body);
      onChanged(); onClose();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const remove = () => {
    setDialog({
      type: 'confirm',
      title: 'Delete Event',
      description: `Delete "${event.title}"? This cannot be undone.`,
      danger: true,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try { await api.del(`/calendar/events/${event.id}`); onChanged(); onClose(); }
        catch (err) { setError(err.message); }
        setDialog(null);
      }
    });
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={isNew ? 'New event' : 'Edit event'}>
        <button className="dclose" onClick={onClose} aria-label="Close">&times;</button>
        <h2>{isNew ? 'New event' : 'Edit event'}</h2>
        {error && <div className="err">{error}</div>}

        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="ev-t">TITLE</label>
            <input id="ev-t" autoFocus required value={draft.title || ''}
                   onChange={e => set('title', e.target.value)} />
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="ev-s">STARTS</label>
              <input id="ev-s" type="datetime-local" required value={toLocalInput(draft.start_at)}
                     onChange={e => set('start_at', fromLocalInput(e.target.value))} />
            </div>
            <div className="field">
              <label htmlFor="ev-e">ENDS</label>
              <input id="ev-e" type="datetime-local" required value={toLocalInput(draft.end_at)}
                     onChange={e => set('end_at', fromLocalInput(e.target.value))} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="ev-l">LOCATION / LINK</label>
            <input id="ev-l" value={draft.location || ''} onChange={e => set('location', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev-a">ATTENDEES</label>
            <input id="ev-a" value={draft.attendees || ''} onChange={e => set('attendees', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev-n">AGENDA / NOTES</label>
            <textarea id="ev-n" value={draft.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="dacts">
            <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create event' : 'Save'}</button>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            {!isNew && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
          </div>
        </form>
      </aside>
      <DialogModal dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
