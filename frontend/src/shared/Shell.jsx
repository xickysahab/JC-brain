import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router-dom';
import { api } from '../shared/api.js';
import { LayoutDashboard, CheckSquare, CalendarDays, Users, Menu, LogOut, ShieldAlert, KeyRound, CloudOff } from 'lucide-react';
import './Shell.css';
import { Toaster } from './undo.jsx';
import CommandPalette from './CommandPalette.jsx';
import Reminders from './Reminders.jsx';
import { useOnline } from './useOnline.js';
import { SPRING, spring } from './motion/spring.js';

const NAV = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/todo',     label: 'Tasks', counter: 'open', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays }
];

export default function Shell({ user, onSignedOut, children }) {
  // Sidebar slides out; on a narrow screen it starts hidden.
  const [open, setOpen] = useState(() => window.innerWidth > 760);
  const [counts, setCounts] = useState({});
  const online = useOnline();
  const railRef = useRef(null);
  const [railWidth, setRailWidth] = useState(0);

  /* The rail slides on a spring, so a second click during the slide re-targets
     the same motion instead of queueing behind it. Its width is measured
     rather than assumed: the breakpoint changes --rail, and a hard-coded
     number would leave a gap at exactly the size where it shows. */
  useLayoutEffect(() => {
    const measure = () => setRailWidth(railRef.current?.offsetWidth || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => { api.get('/tasks/counts').then(setCounts).catch(() => {}); }, []);

  const signOut = async () => {
    // The offline cache holds this user's tasks. Signing out on a shared
    // machine has to take that with it, not just the cookie.
    try { await caches?.delete('jc-data-v1'); } catch { /* no Cache API here */ }
    try { await api.post('/auth/logout'); } finally { onSignedOut(); }
  };

  return (
    <div className="shell">
      <motion.nav
        ref={railRef}
        className="rail"
        aria-label="Sections"
        aria-hidden={!open}
        animate={{ marginLeft: open ? 0 : -railWidth }}
        transition={spring(SPRING.sheet)}
        initial={false}
      >
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
          <NavLink to="/account" className="btn sm"
                   style={{ marginTop: 12, width: '100%', justifyContent: 'flex-start' }}>
            <KeyRound size={16} /> Account
          </NavLink>
          <button className="btn sm" style={{ marginTop: 6, width: '100%', justifyContent: 'flex-start' }} onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </motion.nav>

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
          {!online && <span className="tag warn"><CloudOff size={14} /> Offline — showing the last data loaded</span>}
          <Reminders />
          {counts.overdue > 0 && <span className="tag hot"><ShieldAlert size={14} /> {counts.overdue} overdue</span>}
          {counts.sos > 0 && <span className="tag hot"><ShieldAlert size={14} /> {counts.sos} SOS</span>}
        </header>
        <div className="content">{children}</div>
      </div>

      <Toaster />
      <CommandPalette user={user} />
    </div>
  );
}
