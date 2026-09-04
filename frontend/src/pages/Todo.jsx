import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import TaskModal from '../components/TaskModal.jsx';
import BucketBar from '../components/BucketBar.jsx';
import Triage from '../components/Triage.jsx';
import Board from '../components/Board.jsx';
import { useBuckets, bucketColor } from '../useBuckets.js';
import { useTaskFields } from '../useTaskFields.js';
import { Plus, Info, Check, List, Kanban, Filter, Calendar1, CalendarDays, AlertCircle, CircleDashed, CheckCircle, Search, Trash2 } from 'lucide-react';

const VIEWS = [
  { id: 'open',     label: 'Open', icon: CircleDashed },
  { id: 'today',    label: 'Today', icon: Calendar1 },
  { id: 'overdue',  label: 'Overdue', icon: AlertCircle },
  { id: 'week',     label: 'This week', icon: CalendarDays },
  { id: 'sos',      label: 'SOS', icon: AlertCircle },
  { id: 'progress', label: 'In progress', icon: CircleDashed },
  { id: 'done',     label: 'Done', icon: CheckCircle }
];
const MODES = [
  { id: 'list',   label: 'List view', icon: List },
  { id: 'board',  label: 'Board view', icon: Kanban },
  { id: 'triage', label: 'Triage / Sort', icon: Filter }
];
const EMPTY = {
  open:     ['Nothing open', 'Type above and press Add to capture something.'],
  today:    ['Nothing due today', 'Give a task a deadline and it will show up here.'],
  overdue:  ['Nothing overdue', 'Everything is still on time.'],
  week:     ['No deadlines this week', ''],
  sos:      ['No SOS tasks', 'Mark a task SOS when it cannot wait.'],
  progress: ['Nothing in progress', ''],
  done:     ['Nothing completed yet', '']
};
const hot = l => l === 'OVERDUE' || l === 'DUE TODAY' || l === 'SOS';
const warn = l => l === 'DUE SOON' || l === 'TOMORROW';
const fmt = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

export default function Todo() {
  const [mode, setMode] = useState('list');
  const [view, setView] = useState('open');
  const [bucketId, setBucketId] = useState(null);      // null = all, 'none' = un-bucketed
  const [q, setQ] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [modal, setModal] = useState(null);      // a draft, or an existing task
  const [selected, setSelected] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const store = useBuckets();
  const fieldPrefs = useTaskFields();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ view: mode === 'triage' ? 'unbucketed' : view });
      if (q.trim()) p.set('q', q.trim());
      setTasks((await api.get(`/tasks?${p}`)).tasks);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [mode, view, q]);
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const refresh = () => { load(); store.reload(); };

  /* Add opens the modal rather than saving straight away: what was typed
     becomes the title, and everything else is filled there - or not, since
     Save on its own is a complete action. */
  const add = e => {
    e.preventDefault();
    if (!title.trim()) return;
    setModal({ title: title.trim(), status: 'Todo',
               bucket_id: bucketId && bucketId !== 'none' ? bucketId : null });
    setTitle('');
  };

  const assign = async (taskId, toBucketId) => {
    setBusyId(taskId);
    try { await api.patch(`/tasks/${taskId}`, { bucket_id: toBucketId }); refresh(); }
    catch (err) { setError(err.message); } finally { setBusyId(null); }
  };

  const toggleDone = async t => {
    try { await api.patch(`/tasks/${t.id}`, { status: t.status === 'Done' ? 'Todo' : 'Done' }); refresh(); }
    catch (err) { setError(err.message); }
  };

  const bulk = async payload => {
    try { await api.post('/tasks/bulk', { ids: [...selected], ...payload }); setSelected(new Set()); refresh(); }
    catch (err) { setError(err.message); }
  };
  const toggleSel = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const visible = mode === 'list' && bucketId
    ? tasks.filter(t => (bucketId === 'none' ? !t.bucket_id : t.bucket_id === bucketId))
    : tasks;
  const [emptyTitle, emptyHint] = EMPTY[view] || ['No matches', ''];

  return (
    <>
      <div className="head">
        <h1>Tasks</h1>
        <p>Capture everything first. Sort it into buckets when you are ready.</p>
      </div>

      <form className="quick" onSubmit={add}>
        <input value={title} onChange={e => setTitle(e.target.value)}
               placeholder="What needs doing?" aria-label="New task" />
        <button className="btn primary" disabled={!title.trim()}>
          <Plus size={16} /> Add
        </button>
      </form>

      <BucketBar store={store} selected={bucketId} onSelect={setBucketId} />

      <div className="chips">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {(() => {
            const activeMode = MODES.find(m => m.id === mode);
            return activeMode ? <activeMode.icon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink)' }} /> : null;
          })()}
          <select className="chip" style={{ paddingLeft: 32, paddingRight: 28, appearance: 'none', border: '1px solid var(--border)', background: 'var(--surface)' }} value={mode} onChange={e => { setMode(e.target.value); setSelected(new Set()); }}>
            {MODES.map(m => (
              <option key={m.id} value={m.id}>
                {m.label} {m.id === 'triage' && store.unbucketed > 0 ? `(${store.unbucketed})` : ''}
              </option>
            ))}
          </select>
          <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ width: 10 }} />
        {mode !== 'triage' && (
          <div style={{ position: 'relative', display: 'inline-block', marginRight: 6 }}>
            <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-2)' }} />
            <select className="chip" style={{ paddingLeft: 32, paddingRight: 28, appearance: 'none', border: '1px solid var(--border)', background: 'var(--surface)' }} value={view} onChange={e => { setView(e.target.value); setSelected(new Set()); }}>
              {VIEWS.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        {mode === 'list' && (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
            <input className="chip" style={{ minWidth: 170, paddingLeft: 36, paddingRight: 14 }} type="search" value={q}
                   onChange={e => setQ(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" />
          </div>
        )}
      </div>

      {error && <div className="err">{error}</div>}

      {selected.size > 0 && mode === 'list' && (
        <div className="bulk">
          <strong>{selected.size} selected</strong>
          <select className="chip" style={{ height: 30, margin: 0, border: '1px solid var(--accent-line)', background: 'var(--surface)' }} onChange={e => {
            if (e.target.value) {
              bulk({ patch: { bucket_id: e.target.value } });
              e.target.value = '';
            }
          }}>
            <option value="">Move to bucket…</option>
            {store.buckets.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          
          <span style={{ width: 1, height: 16, background: 'var(--accent-line)', margin: '0 4px' }} />

          <button className="btn sm" onClick={() => bulk({ patch: { status: 'Done' } })}>
            <CheckCircle size={14} /> Mark done
          </button>
          <button className="btn sm danger" onClick={() => bulk({ action: 'delete' })}>
            <Trash2 size={14} /> Delete
          </button>
          <button className="btn sm ghost" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {loading ? [0, 1, 2].map(i => <div key={i} className="skel" />)
        : mode === 'triage' ? (
          <Triage tasks={tasks} buckets={store.buckets} onAssign={assign}
                  onOpen={id => setModal(tasks.find(t => t.id === id))} busyId={busyId} />
        ) : mode === 'board' ? (
          <Board tasks={tasks} buckets={store.buckets} onAssign={assign} onOpen={id => setModal(tasks.find(t => t.id === id))} />
        ) : !visible.length ? (
          <div className="empty"><strong>{emptyTitle}</strong>{emptyHint}</div>
        ) : visible.map(t => {
          const closed = t.status === 'Done' || t.status === 'Cancelled';
          const b = store.buckets.find(x => x.id === t.bucket_id);
          return (
            <div key={t.id} className={'row' + (closed ? ' closed' : '')} onClick={() => setModal(t)}>
              <input type="checkbox" className="apple-checkbox" checked={selected.has(t.id)} 
                     onClick={e => e.stopPropagation()}
                     onChange={() => toggleSel(t.id)}
                     aria-label={`Select ${t.title}`} />
              <div className="rmain">
                <button className="rtitle" onClick={e => e.preventDefault()}>{t.title}</button>
                <div className="rmeta">
                  <span className={'tag' + (hot(t.label) ? ' hot' : warn(t.label) ? ' warn' : '')}>{t.label}</span>
                  {b && <span className="tag"><i className="dot" style={{ background: bucketColor(b) }} />{b.name}</span>}
                  {t.deadline && <span className="tag">due {fmt(t.deadline)}</span>}
                  {t.priority && t.priority !== 'SOS' && <span className="tag">{t.priority}</span>}
                  {t.owner && <span className="tag">@{t.owner}</span>}
                  {t.client && <span className="tag">#{t.client}</span>}
                </div>
              </div>
              <div className="row-actions" onClick={e => e.stopPropagation()}>
                {!closed && <span className="score" title="attention score">{t.score}</span>}
                <button className="btn sm ghost" onClick={() => toggleDone(t)}>
                  <Check size={14} /> {closed ? 'Reopen' : 'Done'}
                </button>
              </div>
            </div>
          );
        })}

      {modal && fieldPrefs.ready && (
        <TaskModal
          task={modal}
          buckets={store.buckets}
          fields={fieldPrefs.fields}
          visible={fieldPrefs.visible}
          onSaveFields={fieldPrefs.save}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
