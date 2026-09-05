import { useState } from 'react';
import { api } from '../../../shared/api.js';

export default function QuickAdd({ editing }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    if (!title.trim() || editing) return;
    setBusy(true); setError(''); setDone('');
    try {
      await api.post('/tasks', { title: title.trim() });
      setTitle(''); setDone('Added');
      setTimeout(() => setDone(''), 2500);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form className="w-quick" onSubmit={submit}>
      <input value={title} onChange={e => setTitle(e.target.value)}
             placeholder="What needs doing?" aria-label="New task" disabled={editing} />
      <button className="btn sm primary" disabled={busy || !title.trim()}>Add</button>
      {error && <span className="msg err-inline">{error}</span>}
      {done && <span className="msg ok-inline">{done}</span>}
    </form>
  );
}
