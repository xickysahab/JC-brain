import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import TaskDrawer from '../components/TaskDrawer.jsx';

const VIEWS = [
  { id: 'open',     label: 'Open' },
  { id: 'today',    label: 'Today' },
  { id: 'overdue',  label: 'Overdue' },
  { id: 'week',     label: 'This week' },
  { id: 'sos',      label: 'SOS' },
  { id: 'progress', label: 'In progress' },
  { id: 'done',     label: 'Done' }
];
const EMPTY = {
  open:     ['Kuch open nahi hai', 'Upar likho aur Enter dabao.'],
  today:    ['Aaj ke liye kuch nahi', 'Kisi task par deadline daal do.'],
  overdue:  ['Kuch overdue nahi', 'Sab time par hai.'],
  week:     ['Is hafte koi deadline nahi', ''],
  sos:      ['Koi SOS nahi', ''],
  progress: ['Abhi kuch chalu nahi', ''],
  done:     ['Abhi kuch complete nahi hua', '']
};
const hot = l => l === 'OVERDUE' || l === 'DUE TODAY' || l === 'SOS';
const warn = l => l === 'DUE SOON' || l === 'TOMORROW';

const fmt = iso => iso
  ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  : '';

export default function Todo() {
  const [view, setView] = useState('open');
  const [q, setQ] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [openId, setOpenId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ view });
      if (q.trim()) p.set('q', q.trim());
      setTasks((await api.get(`/tasks?${p}`)).tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [view, q]);

  // Debounce so typing in search does not fire a request per keystroke.
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const add = async e => {
    e.preventDefault();
    if (!title.trim()) return;
    try { await api.post('/tasks', { title: title.trim() }); setTitle(''); load(); }
    catch (err) { setError(err.message); }
  };

  const toggleDone = async t => {
    try { await api.patch(`/tasks/${t.id}`, { status: t.status === 'Done' ? 'Todo' : 'Done' }); load(); }
    catch (err) { setError(err.message); }
  };

  const bulk = async payload => {
    try { await api.post('/tasks/bulk', { ids: [...selected], ...payload }); setSelected(new Set()); load(); }
    catch (err) { setError(err.message); }
  };

  const toggleSel = id => setSelected(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const openTask = tasks.find(t => t.id === openId) || null;
  const [emptyTitle, emptyHint] = EMPTY[view] || ['Kuch nahi mila', ''];

  return (
    <>
      <div className="head">
        <h1>To-do</h1>
        <p>Overdue apne aap upar aata hai — priority manually set karne ki zaroorat nahi.</p>
      </div>

      <form className="quick" onSubmit={add}>
        <input value={title} onChange={e => setTitle(e.target.value)}
               placeholder="What's on your mind?" aria-label="New task" />
        <button className="btn primary" disabled={!title.trim()}>Add</button>
      </form>

      <div className="chips">
        {VIEWS.map(v => (
          <button key={v.id} className={'chip' + (view === v.id ? ' on' : '')}
                  onClick={() => { setView(v.id); setSelected(new Set()); }}>{v.label}</button>
        ))}
        <input className="chip" style={{ minWidth: 180 }} type="search" value={q}
               onChange={e => setQ(e.target.value)} placeholder="Search…" aria-label="Search tasks" />
      </div>

      {error && <div className="err">{error}</div>}

      {selected.size > 0 && (
        <div className="bulk">
          <strong>{selected.size} selected</strong>
          <button className="btn sm" onClick={() => bulk({ patch: { status: 'Done' } })}>Mark done</button>
          <button className="btn sm" onClick={() => bulk({ patch: { priority: 'SOS' } })}>Mark SOS</button>
          <button className="btn sm" onClick={() => bulk({ patch: { deadline: endOfToday() } })}>Due today</button>
          <button className="btn sm danger" onClick={() => bulk({ action: 'delete' })}>Delete</button>
          <button className="btn sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {loading ? (
        <>{[0, 1, 2].map(i => <div key={i} className="skel" />)}</>
      ) : !tasks.length ? (
        <div className="empty"><strong>{emptyTitle}</strong>{emptyHint}</div>
      ) : tasks.map(t => {
        const closed = t.status === 'Done' || t.status === 'Cancelled';
        return (
          <div key={t.id} className={'row' + (closed ? ' closed' : '')}>
            <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSel(t.id)}
                   aria-label={`Select ${t.title}`} />
            <div className="rmain">
              <button className="rtitle" onClick={() => setOpenId(t.id)}>{t.title}</button>
              <div className="rmeta">
                <span className={'tag' + (hot(t.label) ? ' hot' : warn(t.label) ? ' warn' : '')}>{t.label}</span>
                {t.deadline && <span className="tag">due {fmt(t.deadline)}</span>}
                {t.priority && t.priority !== 'SOS' && <span className="tag">{t.priority}</span>}
                {t.owner && <span className="tag">@{t.owner}</span>}
                {t.client && <span className="tag">#{t.client}</span>}
                {t.category && <span className="tag">{t.category}</span>}
                {t.status === 'In Progress' && <span className="tag ok">In progress</span>}
              </div>
            </div>
            {!closed && <span className="score" title="attention score">{t.score}</span>}
            <button className="btn sm" onClick={() => toggleDone(t)}>{closed ? 'Reopen' : 'Done'}</button>
          </div>
        );
      })}

      {openTask && (
        <TaskDrawer task={openTask} onClose={() => setOpenId(null)} onChanged={load} />
      )}
    </>
  );
}

function endOfToday() { const d = new Date(); d.setHours(23, 59, 0, 0); return d.toISOString(); }
