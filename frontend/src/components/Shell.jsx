import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api.js';

const NAV = [
  { to: '/',         label: 'Dashboard' },
  { to: '/todo',     label: 'Tasks', counter: 'open' },
  { to: '/calendar', label: 'Calendar' }
];

export default function Shell({ user, onSignedOut, children }) {
  // Sidebar slides out; on a narrow screen it starts hidden.
  const [open, setOpen] = useState(() => window.innerWidth > 760);
  const [counts, setCounts] = useState({});

  useEffect(() => { api.get('/tasks/counts').then(setCounts).catch(() => {}); }, []);

  const signOut = async () => {
    try { await api.post('/auth/logout'); } finally { onSignedOut(); }
  };

  return (
    <div className="shell">
      <nav className={`rail${open ? '' : ' closed'}`} aria-label="Sections">
        <div className="brand">JC COMMAND CENTER</div>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}
                   className={({ isActive }) => 'navitem' + (isActive ? ' active' : '')}>
            {n.label}
            {n.counter && counts[n.counter] > 0 && (
              <span className={'ct' + (counts.overdue > 0 && n.counter === 'open' ? ' hot' : '')}>
                {counts[n.counter]}
              </span>
            )}
          </NavLink>
        ))}
        {user.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => 'navitem' + (isActive ? ' active' : '')}>
            Users
          </NavLink>
        )}
        <div className="railfoot">
          <b>{user.name || user.email}</b>
          <span>{user.role === 'admin' ? 'Admin' : 'Client'}</span>
          <button className="btn sm" style={{ marginTop: 8 }} onClick={signOut}>Sign out</button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen(o => !o)}
                  aria-label={open ? 'Hide menu' : 'Show menu'} aria-expanded={open}>&#9776;</button>
          <span className="stamp">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span className="grow" />
          {counts.overdue > 0 && <span className="tag hot">{counts.overdue} overdue</span>}
          {counts.sos > 0 && <span className="tag hot">{counts.sos} SOS</span>}
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
