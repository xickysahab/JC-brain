import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import EventDrawer from '../components/EventDrawer.jsx';
import {
  startOfDay, addDays, addMonths, startOfWeek, startOfMonth, monthGridStart,
  sameDay, isToday, fmtTime, fmtRange, hourOf, layOut, DAY_NAMES
} from '../dates.js';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import * as chrono from 'chrono-node';
import { useBuckets, bucketColor } from '../useBuckets.js';

const DAY_START = 6;              // grid runs 06:00 - 23:00
const DAY_END = 23;
const HOUR_PX = 48;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

export default function Calendar() {
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [data, setData] = useState({ events: [], tasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [quick, setQuick] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);


  const { buckets } = useBuckets();

  const [from, to, days] = useMemo(() => {
    if (view === 'month') { const f = monthGridStart(anchor); return [f, addDays(f, 42), 42]; }
    if (view === 'week')  { const f = startOfWeek(anchor);    return [f, addDays(f, 7), 7]; }
    const f = startOfDay(anchor);                             return [f, addDays(f, 1), 1];
  }, [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setData(await api.get(`/calendar?from=${from.toISOString()}&to=${to.toISOString()}`));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const step = dir => setAnchor(a =>
    view === 'month' ? addMonths(a, dir) : addDays(a, dir * (view === 'week' ? 7 : 1)));

  const openNew = (day, hour = 10) => {
    const start = new Date(day); start.setHours(hour, 0, 0, 0);
    const end = new Date(start); end.setHours(hour + 1);
    setDrawer({ title: '', start_at: start.toISOString(), end_at: end.toISOString() });
  };

  const quickAdd = async e => {
    e.preventDefault();
    if (!quick.trim() || quickBusy) return;
    
    // Help chrono understand "on 6" by converting it to "on the 6 of this month"
    const parsingText = quick.replace(/\bon\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi, 'on the $1 of this month');
    
    // Pass 'anchor' as the reference date so "this month" means the month the user is currently viewing!
    const parsed = chrono.parse(parsingText, anchor, { forwardDate: true });
    
    if (!parsed.length) {
      setError("Couldn't understand the date/time.");
      return;
    }
    const result = parsed[0];
    let start_at = result.start.date();
    let end_at = result.end ? result.end.date() : new Date(start_at.getTime() + 60 * 60 * 1000);
    
    // Use the original 'quick' text when extracting the title, or the parsingText?
    // Using parsingText is safer because result.text corresponds to the matched part of parsingText.
    let title = parsingText.replace(result.text, '').trim();
    // Revert "of this month" if it accidentally leaked into the title (unlikely, but just in case)
    title = title.replace(/of this month/gi, '').trim() || 'New Event';

    setQuickBusy(true);
    try {
      await api.post('/calendar/events', { title, start_at: start_at.toISOString(), end_at: end_at.toISOString() });
      setQuick('');
      load();
    } catch (err) { setError(err.message); } finally { setQuickBusy(false); }
  };

  const onDragStart = (e, item, type) => {
    e.dataTransfer.effectAllowed = 'move';
    if (type === 'event' || (type === 'task' && item.start_date)) {
      const st = type === 'event' ? item.start_at : item.start_date;
      const en = type === 'event' ? item.end_at : item.deadline;
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type, id: item.id,
        ms: new Date(en) - new Date(st),
        h: new Date(st).getHours(),
        m: new Date(st).getMinutes()
      }));
    } else if (type === 'task') {
      // unscheduled task dragging
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type, id: item.id, ms: 60 * 60 * 1000, h: 10, m: 0
      }));
    }
  };

  const drop = async (e, day, hour) => {
    e.preventDefault();
    e.stopPropagation(); // prevent triggering the sidebar drop if it's inside
    let payload; try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    if (!payload?.id) return;

    if (hour == null && payload.type === 'task') {
      hour = payload.h ?? 10;
    }

    const start = new Date(day);
    if (hour == null) start.setHours(payload.h, payload.m, 0, 0);
    else start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + payload.ms);

    try {
      if (payload.type === 'event') {
        await api.patch(`/calendar/events/${payload.id}`,
          { start_at: start.toISOString(), end_at: end.toISOString() });
      } else if (payload.type === 'task') {
        await api.patch(`/tasks/${payload.id}`,
          { start_date: start.toISOString(), deadline: end.toISOString() });
      }
      load();
    } catch (err) { setError(err.message); }
  };
  


  const dropUnschedule = async e => {
    e.preventDefault();
    let payload; try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    if (!payload?.id || payload.type !== 'task') return;

    try {
      await api.patch(`/tasks/${payload.id}`, { start_date: null, deadline: null });
      load();
    } catch (err) { setError(err.message); }
  };

  const allowDrop = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const getBucketStyle = (bucket_id, isTask = false) => {
    if (!bucket_id) return {};
    const b = buckets.find(x => x.id === bucket_id);
    if (!b) return {};
    const col = bucketColor(b);
    return isTask
      ? { borderColor: col, borderLeftWidth: 4, background: `color-mix(in srgb, ${col} 15%, var(--surface))` }
      : { background: col, borderColor: col, color: 'var(--accent-ink)' };
  };

  const eventsOn = day => data.events.filter(ev => sameDay(ev.start_at, day));
  
  // Time-blocked tasks that act like events
  const tasksOn = day => data.tasks
    .filter(t => t.start_date && t.deadline && sameDay(t.start_date, day))
    .map(t => ({ ...t, isTask: true, start_at: t.start_date, end_at: t.deadline }));

  // Tasks that just have a deadline (due date markers)
  const dueTasksOn = day => data.tasks.filter(t => !t.start_date && t.deadline && sameDay(t.deadline, day));

  // Completely unscheduled tasks for the sidebar
  const unscheduledTasks = data.tasks.filter(t => !t.start_date);

  const label = view === 'month'
    ? startOfMonth(anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${startOfWeek(anchor).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(startOfWeek(anchor), 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="head">
        <h1>Calendar</h1>
        <p>Your meetings and time-blocked tasks. Type naturally to quickly add an event.</p>
      </div>

      <form className="quick" onSubmit={quickAdd}>
        <input placeholder="e.g. Sync meeting tomorrow at 3pm" value={quick} onChange={e => setQuick(e.target.value)} disabled={quickBusy} />
        <button className="btn primary" disabled={!quick.trim() || quickBusy}>Add</button>
      </form>

      <div className="calbar">
        <button className="btn sm" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft size={16} /></button>
        <button className="btn sm" onClick={() => setAnchor(startOfDay(new Date()))}>Today</button>
        <button className="btn sm" onClick={() => step(1)} aria-label="Next"><ChevronRight size={16} /></button>
        <strong className="callabel">{label}</strong>
        <span className="grow" />
        {['month', 'week', 'day'].map(v => (
          <button key={v} className={'chip' + (view === v ? ' on' : '')} onClick={() => setView(v)}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
        <button className="btn sm primary" onClick={() => openNew(anchor)}>
          <Plus size={16} /> New event
        </button>
      </div>

      {error && <div className="err">{error}</div>}
      {loading && <div className="muted" style={{ marginBottom: 8 }}>Loading…</div>}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === 'month' ? (
            <div className="month">
              {DAY_NAMES.map(d => <div key={d} className="monthhead">{d}</div>)}
              {Array.from({ length: days }, (_, i) => addDays(from, i)).map(day => {
                const outside = day.getMonth() !== startOfMonth(anchor).getMonth();
                return (
                  <div key={+day} className={'mcell' + (outside ? ' out' : '') + (isToday(day) ? ' today' : '')}
                       onDragOver={allowDrop} onDrop={e => drop(e, day, null)}
                       onDoubleClick={() => openNew(day)}>
                    <div className="mnum">{day.getDate()}</div>
                    {dueTasksOn(day).map(t => (
                      <div key={t.id} className={'tmark' + (t.priority === 'SOS' ? ' sos' : '')} title={`Due: ${t.title}`}>
                        ● {t.title}
                      </div>
                    ))}
                    {[...eventsOn(day), ...tasksOn(day)].sort((a,b)=>new Date(a.start_at)-new Date(b.start_at)).map(ev => (
                      <button key={ev.id} className="mchip" draggable
                              style={getBucketStyle(ev.bucket_id, ev.isTask)}
                              onDragStart={e => onDragStart(e, ev, ev.isTask ? 'task' : 'event')}
                              onClick={() => !ev.isTask && setDrawer(ev)}>
                        <b>{fmtTime(ev.start_at)}</b> {ev.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid">
              <div className="gutter">
                <div className="ghead" />
                {HOURS.map(h => <div key={h} className="ghour">{h}:00</div>)}
              </div>
              {Array.from({ length: days }, (_, i) => addDays(from, i)).map(day => {
                const laid = layOut([...eventsOn(day), ...tasksOn(day)]);
                return (
                  <div key={+day} className={'gcol' + (isToday(day) ? ' today' : '')}>
                    <div className="ghead">
                      <span>{DAY_NAMES[(day.getDay() + 6) % 7]}</span>
                      <b>{day.getDate()}</b>
                      {dueTasksOn(day).map(t => (
                        <div key={t.id} className={'tmark' + (t.priority === 'SOS' ? ' sos' : '')} title={`Due: ${t.title}`}>
                          ● {t.title}
                        </div>
                      ))}
                    </div>
                    <div className="gbody" style={{ height: HOURS.length * HOUR_PX }}>
                      {HOURS.map(h => (
                        <div key={h} className="gslot" style={{ height: HOUR_PX }}
                             onDragOver={allowDrop} onDrop={e => drop(e, day, h)}
                             onDoubleClick={() => openNew(day, h)} />
                      ))}
                      {laid.map(ev => {
                        const top = Math.max(0, (hourOf(ev.start_at) - DAY_START) * HOUR_PX);
                        const bottom = Math.min(HOURS.length * HOUR_PX, (hourOf(ev.end_at) - DAY_START) * HOUR_PX);
                        const width = 100 / (ev.lanes || 1);
                        return (
                          <button key={ev.id} className="gevent" draggable
                                  style={{
                                    top, height: Math.max(24, bottom - top),
                                    left: `${ev.lane * width}%`, width: `calc(${width}% - 3px)`,
                                    ...getBucketStyle(ev.bucket_id, ev.isTask)
                                  }}
                                  onDragStart={e => onDragStart(e, ev, ev.isTask ? 'task' : 'event')}
                                  onClick={() => !ev.isTask && setDrawer(ev)}>
                            <b>{ev.title}</b>
                            <span>{fmtRange(ev.start_at, ev.end_at)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bcol" style={{ flex: '0 0 240px', maxHeight: 'calc(100vh - 180px)' }}
             onDragOver={allowDrop} onDrop={dropUnschedule}>
          <header>
            <i style={{ background: 'var(--border-2)' }} />
            <span>Unscheduled Tasks</span>
            <b>{unscheduledTasks.length}</b>
          </header>
          <div className="bcards">
            {unscheduledTasks.length === 0 ? (
              <p className="bempty">No unscheduled tasks found.</p>
            ) : (
              unscheduledTasks.map(t => (
                <article key={t.id} draggable onDragStart={e => onDragStart(e, t, 'task')}>
                  <div className="ctitle">{t.title}</div>
                  <div className="rmeta" style={{ marginTop: 6, gap: 6 }}>
                    {t.priority === 'SOS' && <span className="tag hot">SOS</span>}
                    {t.bucket_id && buckets.find(b => b.id === t.bucket_id) && (
                      <span className="tag" style={{ color: bucketColor(buckets.find(b => b.id === t.bucket_id)) }}>
                        <i className="dot" style={{ background: 'currentColor' }} />
                        {buckets.find(b => b.id === t.bucket_id).name}
                      </span>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      {drawer && <EventDrawer event={drawer} onClose={() => setDrawer(null)} onChanged={load} />}

    </>
  );
}
