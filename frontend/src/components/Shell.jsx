import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../api.js';
import { LayoutDashboard, CheckSquare, CalendarDays, Users, Menu, LogOut, ShieldAlert } from 'lucide-react';

const NAV = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/todo',     label: 'Tasks', counter: 'open', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays }
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
            <n.icon size={18} />
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
            <Users size={18} />
            Users
          </NavLink>
        )}
        <div className="railfoot">
          <b>{user.name || user.email}</b>
          <span>{user.role === 'admin' ? 'Admin' : 'Client'}</span>
          <button className="btn sm" style={{ marginTop: 12, width: '100%', justifyContent: 'flex-start' }} onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen(o => !o)}
                  aria-label={open ? 'Hide menu' : 'Show menu'} aria-expanded={open}>
            <Menu size={20} />
          </button>
          <span className="stamp">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span className="grow" />
          {counts.overdue > 0 && <span className="tag hot"><ShieldAlert size={14} /> {counts.overdue} overdue</span>}
          {counts.sos > 0 && <span className="tag hot"><ShieldAlert size={14} /> {counts.sos} SOS</span>}
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
