import { useRef, useState } from 'react';
import { bucketColor } from '../../shared/useBuckets.js';
import { tagClass } from '../../shared/urgency.js';
import { useDrag } from '../../shared/motion/useDrag.js';
import { project, springTo } from '../../shared/motion/spring.js';

/* Buckets as columns.

   The browser's own drag-and-drop used to do this, and it is the one API that
   cannot be made to feel like anything: the drag image belongs to the browser,
   the position arrives quantised, there is no velocity and the gesture cannot
   be interrupted. So the card is lifted by hand instead - a fixed clone that
   sits exactly where it was grabbed and tracks the pointer one to one.

   Here a flick *is* projected, unlike on the dashboard: columns are something
   to aim at, so throwing a card sideways should land it where the throw was
   going rather than where the finger happened to stop. */

const GHOST = 'jc-board-lift';

export default function Board({ tasks, buckets, onAssign, onOpen }) {
  const boardRef = useRef(null);
  const [lift, setLift] = useState(null);     // the card in the air
  const [over, setOver] = useState(null);     // the column it would land in

  const columns = [
    { id: 'none', name: 'Uncategorised', color: null },
    ...buckets.map(b => ({ id: b.id, name: b.name, color: bucketColor(b) }))
  ];

  const columnRects = () =>
    [...(boardRef.current?.querySelectorAll('[data-col]') || [])]
      .map(el => ({ id: el.dataset.col, rect: el.getBoundingClientRect() }));

  const centre = c => (c.rect.left + c.rect.right) / 2;

  const columnAt = (x, cols = columnRects()) => {
    if (!cols.length) return null;
    return cols.find(c => x >= c.rect.left && x <= c.rect.right)
      // Past either end of the board, the nearest column is still the intent.
      ?? cols.reduce((best, c) => (Math.abs(centre(c) - x) < Math.abs(centre(best) - x) ? c : best));
  };

  const pick = (task, rect, grabX, grabY, x, y) =>
    setLift({ task, w: rect.width, h: rect.height, grabX, grabY, x, y, flying: false });

  const move = (x, y) => {
    setLift(l => (l ? { ...l, x, y } : l));
    setOver(columnAt(x)?.id ?? null);
  };

  const drop = (task, { x, y, vx, vy, cancelled }) => {
    setOver(null);
    if (cancelled) { setLift(null); return; }

    const cols = columnRects();
    if (!cols.length) { setLift(null); return; }

    /* Projection decides which *neighbouring* column a throw was aimed at, and
       is capped at one column's width to do it. Apple projects a flick the
       full scroll distance because its targets are screen corners; a column is
       280px wide, and an uncapped 1000px/s flick sails past three of them -
       which is not a throw, it is a teleport. */
    const reach = cols[0].rect.width;
    const thrown = Math.max(-reach, Math.min(reach, project(vx)));
    const target = columnAt(x + thrown, cols);

    const from = (task.bucket_id || 'none');
    if (target.id !== from) onAssign(task.id, target.id === 'none' ? null : target.id);

    /* The clone finishes the throw into the column it chose, then goes. The
       list underneath has already been told, so this is only the eye catching
       up with the decision. */
    const dest = { x: centre(target), y: target.rect.top + 60 };
    setLift(l => (l ? { ...l, flying: true } : l));
    let done = 0;
    const clear = () => { if (++done === 2) setLift(null); };
    springTo({ from: x, to: dest.x, velocity: vx, damping: 1, response: 0.3,
               onUpdate: v => setLift(l => (l ? { ...l, x: v } : l)), onRest: clear });
    springTo({ from: y, to: dest.y, velocity: vy, damping: 1, response: 0.3,
               onUpdate: v => setLift(l => (l ? { ...l, y: v } : l)), onRest: clear });
  };

  return (
    <div className="board" ref={boardRef}>
      {columns.map(col => {
        const cards = tasks.filter(t => (t.bucket_id || 'none') === col.id);
        return (
          <section key={col.id} data-col={col.id}
                   className={'bcol' + (over === col.id ? ' over' : '')}>
            <header>
              {col.color && <i style={{ background: col.color }} />}
              <span>{col.name}</span>
              <b>{cards.length}</b>
            </header>
            <div className="bcards">
              {cards.map(t => (
                <Card key={t.id} task={t} onOpen={onOpen}
                      lifted={lift?.task.id === t.id}
                      onPick={pick} onMove={move} onDrop={drop} />
              ))}
              {!cards.length && <p className="bempty">Drop tasks here</p>}
            </div>
          </section>
        );
      })}

      {lift && (
        <article className={GHOST + (lift.flying ? ' flying' : '')}
                 style={{ left: lift.x - lift.grabX, top: lift.y - lift.grabY, width: lift.w }}>
          <div className="ctitle">{lift.task.title}</div>
          <div className="rmeta">
            <span className={tagClass(lift.task.label)}>{lift.task.label}</span>
          </div>
        </article>
      )}
    </div>
  );
}

function Card({ task, lifted, onOpen, onPick, onMove, onDrop }) {
  const ref = useRef(null);
  const moved = useRef(false);

  const { onPointerDown } = useDrag({
    onStart: ({ grabX, grabY, x, y }) => {
      moved.current = true;
      onPick(task, ref.current.getBoundingClientRect(), grabX, grabY, x, y);
    },
    onMove: ({ x, y }) => onMove(x, y),
    onEnd: e => onDrop(task, e)
  });

  return (
    <article
      ref={ref}
      className={lifted ? 'lifting' : ''}
      onPointerDown={e => { moved.current = false; onPointerDown(e); }}
      /* The threshold in useDrag is what keeps these two apart: under it the
         gesture was a click and the card opens; over it, it was a drag. */
      onClick={() => { if (!moved.current) onOpen(task.id); }}
      style={{ cursor: 'pointer' }}
    >
      <div className="ctitle">{task.title}</div>
      <div className="rmeta">
        <span className={tagClass(task.label)}>{task.label}</span>
        {task.owner && <span className="tag">@{task.owner}</span>}
      </div>
    </article>
  );
}
