import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { monthGridStart, addDays, startOfMonth, sameDay, isToday, DAY_NAMES } from '../dates.js';

/* A month at a glance: a dot on days that have a meeting, a bar under days
   that have a deadline. Detail lives on the Calendar page. */
export default function MiniCalendar() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const anchor = new Date();
  const from = monthGridStart(anchor);

  useEffect(() => {
    let alive = true;
    const to = addDays(from, 42);
    api.get(`/calendar?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(d => alive && setData(d))
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.getTime()]);

  if (error) return <div className="w-msg">{error}</div>;
  if (!data) return <div className="w-msg">Loading…</div>;

  const month = startOfMonth(anchor).getMonth();
  return (
    <div className="w-mini">
      <div className="mhead">{anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      <div className="mgrid">
        {DAY_NAMES.map(d => <span key={d} className="mdow">{d[0]}</span>)}
        {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map(day => {
          const events = data.events.filter(e => sameDay(e.start_at, day)).length;
          const due = data.tasks.filter(t => sameDay(t.deadline, day)).length;
          return (
            <span key={+day}
                  className={'mday' + (day.getMonth() !== month ? ' out' : '') + (isToday(day) ? ' today' : '')}
                  title={[events && `${events} event${events > 1 ? 's' : ''}`, due && `${due} due`].filter(Boolean).join(' · ') || undefined}>
              {day.getDate()}
              {(events > 0 || due > 0) && (
                <em className={due > 0 ? 'due' : ''} />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
