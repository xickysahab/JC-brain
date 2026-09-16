import { bucketColor } from '../../shared/useBuckets.js';
import { Liftable } from '../../shared/motion/lift.jsx';

/* The parking bay for tasks with no time yet. Dragging one onto the grid is
   what schedules it, so this panel is a drop target in both directions. */
export default function UnscheduledPanel({ tasks, buckets, zone, payloadFor }) {
  return (
    <div className={'bcol unscheduled' + (zone.over === 'unschedule' ? ' dropping' : '')}
         data-drop="unschedule">
      <header>
        <i style={{ background: 'var(--border-2)' }} />
        <span>Unscheduled tasks</span>
        <b>{tasks.length}</b>
      </header>
      <div className="bcards">
        {!tasks.length ? <p className="bempty">Everything has a time.</p> : tasks.map(t => {
          const bucket = buckets.find(b => b.id === t.bucket_id);
          return (
            <Liftable key={t.id} as="article" zone={zone} label={t.title}
                      payload={payloadFor(t, 'task')}>
              <div className="ctitle">{t.title}</div>
              <div className="rmeta">
                {t.priority === 'SOS' && <span className="tag hot">SOS</span>}
                {bucket && (
                  <span className="tag" style={{ color: bucketColor(bucket) }}>
                    <i className="dot" style={{ background: 'currentColor' }} />{bucket.name}
                  </span>
                )}
              </div>
            </Liftable>
          );
        })}
      </div>
    </div>
  );
}
