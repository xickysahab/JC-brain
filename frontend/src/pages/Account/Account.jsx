import { useState } from 'react';
import { api, apiUrl } from '../../shared/api.js';
import { KeyRound, Download } from 'lucide-react';

/* Changing your own password. The API has always had the route; until now
   there was no screen for it, which meant the only way to rotate a password
   was for an admin to reset it for you. */
export default function Account({ user }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async e => {
    e.preventDefault();
    setError(''); setNotice('');
    if (form.next !== form.confirm) { setError('The two new passwords do not match'); return; }
    setBusy(true);
    try {
      await api.post('/auth/password', { current: form.current, next: form.next });
      setForm({ current: '', next: '', confirm: '' });
      setNotice('Password changed. It applies the next time you sign in.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="head">
        <h1>Account</h1>
        <p>Signed in as {user.name || user.email} ({user.role === 'admin' ? 'Admin' : 'Client'}).</p>
      </div>

      {error && <div className="err">{error}</div>}
      {notice && <div className="ok">{notice}</div>}

      <form className="card" onSubmit={submit} style={{ maxWidth: 460 }}>
        <h3><KeyRound size={16} style={{ verticalAlign: '-3px', marginRight: 8 }} />Change password</h3>
        <div className="field">
          <label htmlFor="cur">CURRENT PASSWORD</label>
          <input id="cur" type="password" required autoComplete="current-password"
                 value={form.current} onChange={e => set('current', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="nxt">NEW PASSWORD</label>
          <input id="nxt" type="password" required minLength={8} autoComplete="new-password"
                 value={form.next} onChange={e => set('next', e.target.value)} />
          <p className="muted" style={{ marginTop: 5 }}>At least 8 characters.</p>
        </div>
        <div className="field">
          <label htmlFor="cfm">CONFIRM NEW PASSWORD</label>
          <input id="cfm" type="password" required minLength={8} autoComplete="new-password"
                 value={form.confirm} onChange={e => set('confirm', e.target.value)} />
        </div>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </form>

      <div className="card" style={{ maxWidth: 460, marginTop: 16 }}>
        <h3><Download size={16} style={{ verticalAlign: '-3px', marginRight: 8 }} />Export your tasks</h3>
        <p className="muted" style={{ margin: '0 0 12px' }}>
          Every task you have, with its buckets, dates and checklists. CSV opens in a
          spreadsheet; JSON keeps the structure for moving it somewhere else.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn" href={apiUrl('/tasks/export?format=csv')}>CSV</a>
          <a className="btn" href={apiUrl('/tasks/export?format=json')}>JSON</a>
        </div>
      </div>
    </>
  );
}
