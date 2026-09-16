import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api.js';
import TaskModal from './TaskModal.jsx';
import BucketBar from './BucketBar.jsx';
import Triage from './Triage.jsx';
import Board from './Board.jsx';
import QuickCapture from './QuickCapture.jsx';
import { useListKeys } from './useListKeys.js';
import { useBuckets, bucketColor } from '../../shared/useBuckets.js';
import { useTaskFields } from './useTaskFields.js';
import { Plus, Info, Check, List, Kanban, Filter, Calendar1, CalendarDays, AlertCircle, CircleDashed, CheckCircle, Search, Trash2, Repeat, ListChecks } from 'lucide-react';
import { tagClass } from '../../shared/urgency.js';
import './Tasks.css';
import { usePendingHidden } from '../../shared/undo.jsx';

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
const fmt = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');

export default function Todo() {
  const [mode, setMode] = useState('list');
  const [view, setView] = useState('open');
  const [bucketId, setBucketId] = useState(null);      // null = all, 'none' = un-bucketed
  const [q, setQ] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);      // a draft, or an existing task
  const [selected, setSelected] = useState(() => new Set());
  const store = useBuckets();
  const hidden = usePendingHidden();
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

  /* The command palette navigates here and leaves a note about what it wanted.
     Reading it on arrival is what makes ⌘K land on a task rather than a page. */
  useEffect(() => {
    const jump = () => {
      const b = sessionStorage.getItem('jc.jump.bucket');
      const t = sessionStorage.getItem('jc.jump.task');
      const f = sessionStorage.getItem('jc.jump.focus');
      sessionStorage.removeItem('jc.jump.bucket');
      sessionStorage.removeItem('jc.jump.task');
      sessionStorage.removeItem('jc.jump.focus');
      if (b) { setMode('list'); setBucketId(b); }
      if (f === 'capture') document.querySelector('.capture textarea')?.focus();
      if (t) api.get(`/tasks?view=all`).then(d => {
        const found = d.tasks.find(x => x.id === t);
        if (found) setModal(found);
      }).catch(() => {});
    };
    jump();
    window.addEventListener('jc:jump', jump);
    return () => window.removeEventListener('jc:jump', jump);
  }, []);

  /* Enter goes straight to the server. The modal is still one keystroke away
     (⌘Enter), but it is no longer the price of capturing a thought. */
  /* Optimistic writes.

     The screen changes on the keystroke and the server catches up. No click is
     saved by this - but "the app feels fast" is almost always this and nothing
     else. Every one of them puts the old value back if the call fails, so a
     dropped connection never leaves a lie on screen. */
  const optimistic = async (apply, undo, call) => {
    setError('');
    apply();
    try { await call(); }
    catch (err) { undo(); setError(err.message); return; }
    refresh();                       // reconcile: server owns score and urgency
  };

  const create = drafts => {
    // Placeholder rows carry the fields we know; the refetch swaps in the
    // server's version with its computed urgency and score.
    const temps = drafts.map((d, i) => ({
      ...d, id: `tmp-${Date.now()}-${i}`, label: 'UNSCHEDULED', score: 10, pending: true
    }));
    return optimistic(
      () => setTasks(ts => [...temps, ...ts]),
      () => setTasks(ts => ts.filter(t => !temps.some(x => x.id === t.id))),
      () => Promise.all(drafts.map(d => api.post('/tasks', d)))
    );
  };

  const assign = (taskId, toBucketId) => {
    const before = tasks.find(t => t.id === taskId)?.bucket_id ?? null;
    const set = v => setTasks(ts => ts.map(t => (t.id === taskId ? { ...t, bucket_id: v } : t)));
    return optimistic(() => set(toBucketId), () => set(before),
                      () => api.patch(`/tasks/${taskId}`, { bucket_id: toBucketId }));
  };

  const toggleDone = t => {
    const next = t.status === 'Done' ? 'Todo' : 'Done';
    const set = v => setTasks(ts => ts.map(x => (x.id === t.id ? { ...x, status: v } : x)));
    return optimistic(() => set(next), () => set(t.status),
                      () => api.patch(`/tasks/${t.id}`, { status: next }));
  };

  const bulk = async payload => {
    try { await api.post('/tasks/bulk', { ids: [...selected], ...payload }); setSelected(new Set()); refresh(); }
    catch (err) { setError(err.message); }
  };
  const toggleSel = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const shown = tasks.filter(t => !hidden.has(t.id));
  const visible = mode === 'list' && bucketId
    ? shown.filter(t => (bucketId === 'none' ? !t.bucket_id : t.bucket_id === bucketId))
    : shown;
  const [focusIdx] = useListKeys({
    tasks: visible,
    buckets: store.buckets,
    enabled: mode === 'list',
    onOpen: setModal,
    onToggleDone: toggleDone,
    onAssign: assign,
    onSelect: toggleSel
  });

  const [emptyTitle, emptyHint] = EMPTY[view] || ['No matches', ''];

  return (
    <>
      <div className="head">
        <h1>Tasks</h1>
        <p>Capture everything first. Sort it into buckets when you are ready.</p>
      </div>

      <QuickCapture
        buckets={store.buckets}
        defaultBucketId={bucketId}
        onCreate={create}
        onOpenForm={setModal}
      />


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
          <Triage tasks={shown} buckets={store.buckets} onAssign={assign}
                  onOpen={id => setModal(tasks.find(t => t.id === id))} />
        ) : mode === 'board' ? (
          <Board tasks={shown} buckets={store.buckets} onAssign={assign} onOpen={id => setModal(tasks.find(t => t.id === id))} />
        ) : !visible.length ? (
          <div className="empty"><strong>{emptyTitle}</strong>{emptyHint}</div>
        ) : visible.map(t => {
          const closed = t.status === 'Done' || t.status === 'Cancelled';
          const b = store.buckets.find(x => x.id === t.bucket_id);
          return (
            <div key={t.id} className={'row' + (closed ? ' closed' : '') + (visible[focusIdx]?.id === t.id ? ' focused' : '') + (t.pending ? ' pending' : '')} onClick={() => setModal(t)}>
              <input type="checkbox" className="apple-checkbox" checked={selected.has(t.id)} 
                     onClick={e => e.stopPropagation()}
                     onChange={() => toggleSel(t.id)}
                     aria-label={`Select ${t.title}`} />
              <div className="rmain">
                <button className="rtitle" onClick={e => e.preventDefault()}>{t.title}</button>
                <div className="rmeta">
                  <span className={tagClass(t.label)}>{t.label}</span>
                  {b && <span className="tag"><i className="dot" style={{ background: bucketColor(b) }} />{b.name}</span>}
                  {t.deadline && <span className="tag">due {fmt(t.deadline)}</span>}
                  {t.repeat && <span className="tag"><Repeat size={11} /> {t.repeat}</span>}
                  {t.subtasks?.length > 0 && (
                    <span className="tag"><ListChecks size={11} /> {t.subtasks.filter(s => s.done).length}/{t.subtasks.length}</span>
                  )}
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

      {mode === 'list' && visible.length > 0 && (
        <div className="keyhints">
          <span><kbd>j</kbd><kbd>k</kbd> move</span>
          <span><kbd>e</kbd> open</span>
          <span><kbd>d</kbd> done</span>
          <span><kbd>x</kbd> select</span>
          <span><kbd>1</kbd>–<kbd>9</kbd> bucket</span>
          <span><kbd>c</kbd> capture</span>
          <span><kbd>/</kbd> search</span>
          <span><kbd>⌘K</kbd> anything</span>
        </div>
      )}

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
