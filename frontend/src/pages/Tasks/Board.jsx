import { bucketColor } from '../../shared/useBuckets.js';
import { tagClass } from '../../shared/urgency.js';
import { useLiftZone, Liftable, LiftGhost } from '../../shared/motion/lift.jsx';
import { project } from '../../shared/motion/spring.js';

/* Buckets as columns.

   The lifting itself is the shared gesture - the card stays under the finger
   at the offset it was grabbed, and the column beneath lights up. The one
   thing that is the board's own is where a throw is aimed. */

const Ghost = ({ task }) => (
  <>
    <div className="ctitle">{task.title}</div>
    <div className="rmeta"><span className={tagClass(task.label)}>{task.label}</span></div>
  </>
);

export default function Board({ tasks, buckets, onAssign, onOpen }) {
  /* A flick is projected, unlike on the dashboard: columns are something to
     aim at. It is capped at one column's width - Apple projects the full
     scroll distance because its targets are screen corners, and an uncapped
     1000px/s flick sails past three 280px columns, which is not a throw but a
     teleport. */
  const release = (x, y, vx) => {
    const reach = document.querySelector('[data-drop]')?.getBoundingClientRect().width ?? 280;
    return [x + Math.max(-reach, Math.min(reach, project(vx))), y];
  };

  const zone = useLiftZone(
    (task, target) => {
      if ((task.bucket_id || 'none') !== target) onAssign(task.id, target === 'none' ? null : target);
    },
    { release }
  );

  const columns = [
    { id: 'none', name: 'Uncategorised', color: null },
    ...buckets.map(b => ({ id: b.id, name: b.name, color: bucketColor(b) }))
  ];

  return (
    <div className={'board' + (zone.lift ? ' lifting' : '')}>
      {columns.map(col => {
        const cards = tasks.filter(t => (t.bucket_id || 'none') === col.id);
        return (
          <section key={col.id} data-drop={col.id}
                   className={'bcol' + (zone.over === col.id ? ' dropping' : '')}>
            <header>
              {col.color && <i style={{ background: col.color }} />}
              <span>{col.name}</span>
              <b>{cards.length}</b>
            </header>
            <div className="bcards">
              {cards.map(t => (
                <Liftable key={t.id} as="article" zone={zone} payload={t}
                          ghost={<Ghost task={t} />}
                          className={zone.lift?.payload.id === t.id ? 'lifting' : ''}
                          onClick={() => onOpen(t.id)}>
                  <div className="ctitle">{t.title}</div>
                  <div className="rmeta">
                    <span className={tagClass(t.label)}>{t.label}</span>
                    {t.owner && <span className="tag">@{t.owner}</span>}
                  </div>
                </Liftable>
              ))}
              {!cards.length && <p className="bempty">Drop tasks here</p>}
            </div>
          </section>
        );
      })}

      <LiftGhost lift={zone.lift} />
    </div>
  );
}
