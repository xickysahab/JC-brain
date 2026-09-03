import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const { user } = await api.post('/auth/login', { email, password });
      onSignedIn(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form onSubmit={submit}>
        <div className="brand">JC COMMAND CENTER</div>
        <h1>Sign in</h1>
        <p className="muted" style={{ margin: '0 0 18px' }}>Accounts are created by the admin.</p>
        {error && <div className="err">{error}</div>}
        <div className="field">
          <label htmlFor="email">EMAIL</label>
          <input id="email" type="email" autoComplete="username" required
                 value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw">PASSWORD</label>
          <input id="pw" type="password" autoComplete="current-password" required
                 value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
