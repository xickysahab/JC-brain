import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import TaskModal from '../components/TaskModal.jsx';
import BucketBar from '../components/BucketBar.jsx';
import Triage from '../components/Triage.jsx';
import Board from '../components/Board.jsx';
import { useBuckets, bucketColor } from '../useBuckets.js';
import { useTaskFields } from '../useTaskFields.js';

const VIEWS = [
  { id: 'open',     label: 'Open' },
  { id: 'today',    label: 'Today' },
  { id: 'overdue',  label: 'Overdue' },
  { id: 'week',     label: 'This week' },
  { id: 'sos',      label: 'SOS' },
  { id: 'progress', label: 'In progress' },
  { id: 'done',     label: 'Done' }
];
const MODES = [
  { id: 'list',   label: 'List' },
  { id: 'board',  label: 'Board' },
  { id: 'triage', label: 'Triage' }
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
  const [emptyTitle, emptyHint] = EMPTY[view] || ['Kuch nahi mila', ''];

  return (
    <>
      <div className="head">
        <h1>To-do</h1>
        <p>Pehle sab dump karo — phir Triage se apne buckets mein baant do.</p>
      </div>

      <form className="quick" onSubmit={add}>
        <input value={title} onChange={e => setTitle(e.target.value)}
               placeholder="What's on your mind?" aria-label="New task" />
        <button className="btn primary" disabled={!title.trim()}>Add</button>
      </form>

      <BucketBar store={store} selected={bucketId} onSelect={setBucketId} />

      <div className="chips">
        {MODES.map(m => (
          <button key={m.id} className={'chip' + (mode === m.id ? ' on' : '')}
                  onClick={() => { setMode(m.id); setSelected(new Set()); }}>
            {m.label}{m.id === 'triage' && store.unbucketed > 0 ? ` (${store.unbucketed})` : ''}
          </button>
        ))}
        <span style={{ width: 10 }} />
        {mode !== 'triage' && VIEWS.map(v => (
          <button key={v.id} className={'chip' + (view === v.id ? ' on' : '')}
                  onClick={() => { setView(v.id); setSelected(new Set()); }}>{v.label}</button>
        ))}
        {mode === 'list' && (
          <input className="chip" style={{ minWidth: 170 }} type="search" value={q}
                 onChange={e => setQ(e.target.value)} placeholder="Search…" aria-label="Search tasks" />
        )}
      </div>

      {error && <div className="err">{error}</div>}

      {selected.size > 0 && mode === 'list' && (
        <div className="bulk">
          <strong>{selected.size} selected</strong>
          {store.buckets.map(b => (
            <button key={b.id} className="btn sm" onClick={() => bulk({ patch: { bucket_id: b.id } })}>
              &rarr; {b.name}
            </button>
          ))}
          <button className="btn sm" onClick={() => bulk({ patch: { status: 'Done' } })}>Mark done</button>
          <button className="btn sm danger" onClick={() => bulk({ action: 'delete' })}>Delete</button>
          <button className="btn sm" onClick={() => setSelected(new Set())}>Clear</button>
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
            <div key={t.id} className={'row' + (closed ? ' closed' : '')}>
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSel(t.id)}
                     aria-label={`Select ${t.title}`} />
              <div className="rmain">
                <button className="rtitle" onClick={() => setModal(t)}>{t.title}</button>
                <div className="rmeta">
                  <span className={'tag' + (hot(t.label) ? ' hot' : warn(t.label) ? ' warn' : '')}>{t.label}</span>
                  {b && <span className="tag"><i className="dot" style={{ background: bucketColor(b) }} />{b.name}</span>}
                  {t.deadline && <span className="tag">due {fmt(t.deadline)}</span>}
                  {t.priority && t.priority !== 'SOS' && <span className="tag">{t.priority}</span>}
                  {t.owner && <span className="tag">@{t.owner}</span>}
                  {t.client && <span className="tag">#{t.client}</span>}
                </div>
              </div>
              {!closed && <span className="score" title="attention score">{t.score}</span>}
              <button className="btn sm ibtn" title="Details" aria-label={`Open ${t.title}`}
                      onClick={() => setModal(t)}>i</button>
              <button className="btn sm" onClick={() => toggleDone(t)}>{closed ? 'Reopen' : 'Done'}</button>
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
