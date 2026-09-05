import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import DialogModal from '../../shared/DialogModal.jsx';

/* Account management only. There is no route here that reads another user's
   tasks - that was the product decision, so the screen cannot offer it. */
export default function Admin({ me }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);

  const load = () => api.get('/admin/users').then(d => setUsers(d.users)).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async e => {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      await api.post('/admin/users', form);
      setNotice(`Account created for ${form.email}. Send them the password yourself — it is not shown again.`);
      setForm({ name: '', email: '', password: '' });
      load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const resetPassword = u => {
    setDialog({
      type: 'prompt',
      title: 'Reset Password',
      description: `New password for ${u.email} (at least 8 characters):`,
      onConfirm: async password => {
        if (!password) {
          setDialog(null);
          return;
        }
        setError(''); setNotice('');
        try { 
          await api.post(`/admin/users/${u.id}/password`, { password }); 
          setNotice(`Password updated for ${u.email}.`); 
        }
        catch (err) { setError(err.message); }
        setDialog(null);
      }
    });
  };

  const setActive = async (u, is_active) => {
    setError(''); setNotice('');
    try { await api.patch(`/admin/users/${u.id}`, { is_active }); load(); }
    catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="head">
        <h1>Users</h1>
        <p>You create the accounts. Their data stays theirs — you cannot see another user's tasks.</p>
      </div>

      {error && <div className="err">{error}</div>}
      {notice && <div className="ok">{notice}</div>}

      <div className="tw">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Tasks</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name || '—'}</td>
                <td>{u.email}</td>
                <td><span className="tag">{u.role}</span></td>
                <td>{u.task_count}</td>
                <td><span className={'tag' + (u.is_active ? ' ok' : ' hot')}>{u.is_active ? 'active' : 'disabled'}</span></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm" onClick={() => resetPassword(u)}>Reset password</button>{' '}
                  {u.id !== me.id && (
                    <button className="btn sm" onClick={() => setActive(u, !u.is_active)}>
                      {u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={create}>
        <h3>Add a user</h3>
        <div className="field">
          <label htmlFor="n">NAME</label>
          <input id="n" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="e">EMAIL</label>
          <input id="e" type="email" required value={form.email}
                 onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="p">TEMPORARY PASSWORD</label>
          <input id="p" required minLength={8} value={form.password}
                 onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <p className="muted" style={{ marginTop: 5 }}>
            At least 8 characters. It is not shown again, so copy it before you save.
          </p>
        </div>
        <button className="btn primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
      </form>
      <DialogModal dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
