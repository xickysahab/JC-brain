import { addDays, isToday, startOfMonth, fmtTime, DAY_NAMES } from '../../shared/dates.js';

/* The month view. Everything it needs arrives as props, so the page keeps the
   state and the drag handlers and this file only draws. */
export default function MonthGrid({
  from, days, anchor, eventsOn, tasksOn, dueTasksOn,
  getBucketStyle, onDragStart, onDrop, allowDrop, onOpenNew, onOpenEvent
}) {
  return (
    <div className="month">
      {DAY_NAMES.map(d => <div key={d} className="monthhead">{d}</div>)}
      {Array.from({ length: days }, (_, i) => addDays(from, i)).map(day => {
        const outside = day.getMonth() !== startOfMonth(anchor).getMonth();
        return (
          <div key={+day} className={'mcell' + (outside ? ' out' : '') + (isToday(day) ? ' today' : '')}
               onDragOver={allowDrop} onDrop={e => onDrop(e, day, null)}
               onDoubleClick={() => onOpenNew(day)}>
            <div className="mnum">{day.getDate()}</div>
            {dueTasksOn(day).map(t => (
              <div key={t.id} className={'tmark' + (t.priority === 'SOS' ? ' sos' : '')} title={`Due: ${t.title}`}>
                ● {t.title}
              </div>
            ))}
            {[...eventsOn(day), ...tasksOn(day)]
              .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
              .map(ev => (
                <button key={ev.id} className="mchip" draggable
                        style={getBucketStyle(ev.bucket_id, ev.isTask)}
                        onDragStart={e => onDragStart(e, ev, ev.isTask ? 'task' : 'event')}
                        onClick={() => !ev.isTask && onOpenEvent(ev)}>
                  <b>{fmtTime(ev.start_at)}</b> {ev.title}
                </button>
              ))}
          </div>
        );
      })}
    </div>
  );
}
