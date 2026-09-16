import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, CalendarDays, Users, Plus, Search, CornerDownLeft } from 'lucide-react';
import { api } from './api.js';
import { rank } from './fuzzy.js';

/* One shortcut that reaches everything.

   Navigation is the tax an app charges for having more than one screen. ⌘K
   removes it: type three letters of a task name and press Enter, and you are
   in the task - no page, no scroll, no filter. */

const PAGES = [
  { id: 'p-dash', label: 'Dashboard',      hint: 'Go to',  icon: LayoutDashboard, to: '/' },
  { id: 'p-task', label: 'Tasks',          hint: 'Go to',  icon: CheckSquare,     to: '/todo' },
  { id: 'p-cal',  label: 'Calendar',       hint: 'Go to',  icon: CalendarDays,    to: '/calendar' },
  { id: 'p-usr',  label: 'Users',          hint: 'Go to',  icon: Users,           to: '/admin', adminOnly: true }
];

export default function CommandPalette({ user }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tasks, setTasks] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Everything the palette can reach is loaded once per opening, not per keystroke.
  useEffect(() => {
    if (!open) { setQ(''); setCursor(0); return; }
    inputRef.current?.focus();
    Promise.all([
      api.get('/tasks?view=open').then(d => d.tasks).catch(() => []),
      api.get('/buckets').then(d => d.buckets).catch(() => [])
    ]).then(([t, b]) => { setTasks(t); setBuckets(b); });
  }, [open]);

  const items = useMemo(() => {
    const all = [
      ...PAGES.filter(p => !p.adminOnly || user?.role === 'admin'),
      { id: 'a-task',   label: 'New task',   hint: 'Create', icon: Plus, to: '/todo',     focus: 'capture' },
      { id: 'a-event',  label: 'New event',  hint: 'Create', icon: Plus, to: '/calendar', focus: 'capture' },
      ...buckets.map(b => ({ id: 'b-' + b.id, label: b.name, hint: 'Bucket', icon: CheckSquare,
                             to: '/todo', bucket: b.id })),
      ...tasks.map(t => ({ id: 't-' + t.id, label: t.title, hint: t.bucket || 'Task',
                           icon: CheckSquare, to: '/todo', task: t.id }))
    ];
    return q.trim() ? rank(q, all) : all.slice(0, 9);
  }, [q, tasks, buckets, user]);

  const run = useCallback(item => {
    if (!item) return;
    setOpen(false);
    navigate(item.to);
    // The destination page reads these on mount; a hash keeps it out of the URL bar's way.
    if (item.bucket) sessionStorage.setItem('jc.jump.bucket', item.bucket);
    if (item.task) sessionStorage.setItem('jc.jump.task', item.task);
    if (item.focus) sessionStorage.setItem('jc.jump.focus', item.focus);
    window.dispatchEvent(new CustomEvent('jc:jump'));
  }, [navigate]);

  const onKeyDown = e => {
    if (e.key === 'Escape') return setOpen(false);
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(items.length - 1, c + 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
    if (e.key === 'Enter')     { e.preventDefault(); run(items[cursor]); }
  };

  if (!open) return null;
  return (
    <>
      <div className="scrim" style={{ zIndex: 70 }} onClick={() => setOpen(false)} />
      <div className="cmdk" role="dialog" aria-label="Command palette">
        <div className="cmdk-input">
          <Search size={17} />
          <input ref={inputRef} value={q} placeholder="Search tasks, buckets and pages…"
                 onChange={e => { setQ(e.target.value); setCursor(0); }}
                 onKeyDown={onKeyDown} aria-label="Command" />
          <kbd>esc</kbd>
        </div>
        {items.length === 0 ? (
          <p className="cmdk-empty">Nothing matches &ldquo;{q}&rdquo;</p>
        ) : (
          <ul className="cmdk-list">
            {items.map((it, i) => (
              <li key={it.id}>
                <button className={i === cursor ? 'on' : ''}
                        onMouseEnter={() => setCursor(i)} onClick={() => run(it)}>
                  <it.icon size={15} />
                  <span className="l">{it.label}</span>
                  <span className="h">{it.hint}</span>
                  {i === cursor && <CornerDownLeft size={13} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
