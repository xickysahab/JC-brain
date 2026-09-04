import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import EventDrawer from '../components/EventDrawer.jsx';
import {
  startOfDay, addDays, addMonths, startOfWeek, startOfMonth, monthGridStart,
  sameDay, isToday, fmtTime, fmtRange, hourOf, layOut, DAY_NAMES
} from '../dates.js';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

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

  /* Drag to reschedule. The drag carries the event id plus its length, so the
     drop only has to decide a new start; snapping is to the hour. */
  const onDragStart = (e, ev) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
      id: ev.id,
      ms: new Date(ev.end_at) - new Date(ev.start_at),
      h: new Date(ev.start_at).getHours(),
      m: new Date(ev.start_at).getMinutes()
    }));
  };
  const drop = async (e, day, hour) => {
    e.preventDefault();
    let payload; try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    if (!payload?.id) return;

    const start = new Date(day);
    // In month view the time of day is kept; in a time grid the slot decides it.
    if (hour == null) start.setHours(payload.h, payload.m, 0, 0);
    else start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + payload.ms);

    try {
      await api.patch(`/calendar/events/${payload.id}`,
        { start_at: start.toISOString(), end_at: end.toISOString() });
      load();
    } catch (err) { setError(err.message); }
  };
  const allowDrop = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const eventsOn = day => data.events.filter(ev => sameDay(ev.start_at, day));
  const tasksOn = day => data.tasks.filter(t => sameDay(t.deadline, day));

  const label = view === 'month'
    ? startOfMonth(anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${startOfWeek(anchor).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(startOfWeek(anchor), 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="head">
        <h1>Calendar</h1>
        <p>Your meetings, with task deadlines marked alongside. Drag an event to reschedule it.</p>
      </div>

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
                {tasksOn(day).map(t => (
                  <div key={t.id} className={'tmark' + (t.priority === 'SOS' ? ' sos' : '')} title={`Task deadline: ${t.title}`}>
                    ● {t.title}
                  </div>
                ))}
                {eventsOn(day).map(ev => (
                  <button key={ev.id} className="mchip" draggable
                          onDragStart={e => onDragStart(e, ev)}
                          onClick={() => setDrawer(ev)}>
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
            const laid = layOut(eventsOn(day));
            return (
              <div key={+day} className={'gcol' + (isToday(day) ? ' today' : '')}>
                <div className="ghead">
                  <span>{DAY_NAMES[(day.getDay() + 6) % 7]}</span>
                  <b>{day.getDate()}</b>
                  {tasksOn(day).map(t => (
                    <div key={t.id} className={'tmark' + (t.priority === 'SOS' ? ' sos' : '')} title={`Task deadline: ${t.title}`}>
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
                              onDragStart={e => onDragStart(e, ev)}
                              onClick={() => setDrawer(ev)}
                              style={{ top, height: Math.max(24, bottom - top),
                                       left: `${ev.lane * width}%`, width: `calc(${width}% - 3px)` }}>
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

      <p className="muted" style={{ marginTop: 10 }}>
        Double-click empty space to create an event · drag an event to reschedule (snaps to the hour)
      </p>

      {drawer && <EventDrawer event={drawer} onClose={() => setDrawer(null)} onChanged={load} />}
    </>
  );
}
