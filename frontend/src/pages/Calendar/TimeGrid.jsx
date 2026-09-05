import { addDays, isToday, fmtRange, hourOf, layOut, DAY_NAMES } from '../../shared/dates.js';

export const DAY_START = 6;      // the grid runs 06:00 - 23:00
const DAY_END = 23;
export const HOUR_PX = 48;
export const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);

/* Week and day share one component - a day is simply a week of one column. */
export default function TimeGrid({
  from, days, eventsOn, tasksOn, dueTasksOn,
  getBucketStyle, onDragStart, onDrop, allowDrop, onOpenNew, onOpenEvent
}) {
  return (
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
                     onDragOver={allowDrop} onDrop={e => onDrop(e, day, h)}
                     onDoubleClick={() => onOpenNew(day, h)} />
              ))}
              {laid.map(ev => {
                const top = Math.max(0, (hourOf(ev.start_at) - DAY_START) * HOUR_PX);
                const bottom = Math.min(HOURS.length * HOUR_PX, (hourOf(ev.end_at) - DAY_START) * HOUR_PX);
                const width = 100 / (ev.lanes || 1);
                return (
                  <button key={ev.id} className="gevent" draggable
                          style={{ top, height: Math.max(24, bottom - top),
                                   left: `${ev.lane * width}%`, width: `calc(${width}% - 3px)`,
                                   ...getBucketStyle(ev.bucket_id, ev.isTask) }}
                          onDragStart={e => onDragStart(e, ev, ev.isTask ? 'task' : 'event')}
                          onClick={() => !ev.isTask && onOpenEvent(ev)}>
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
  );
}
