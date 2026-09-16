import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDrag } from './useDrag.js';

/* Picking something up and putting it somewhere else.

   The browser's drag-and-drop is the only API in the platform that cannot be
   made to feel like anything - the drag image is the browser's, the position
   arrives quantised, and the gesture cannot be interrupted. This is the
   replacement: a pill that tracks the pointer exactly, and a drop resolved by
   asking what is under it.

   Drop targets say so in the DOM with data-drop="<key>", so a target can be
   added by marking it up rather than by registering it here. */

const targetAt = (x, y) =>
  document.elementFromPoint(x, y)?.closest('[data-drop]')?.dataset.drop ?? null;

/**
 * @param {(payload:any, target:string) => void} onDrop
 * @param {{release?: (x:number,y:number,vx:number,vy:number) => number[]}} [opts]
 *   release maps where the finger let go to where the throw was aimed - the
 *   board projects a flick at its columns, the calendar drops on the hour it
 *   is over. Identity by default.
 * @returns {{lift:object|null, over:string|null, api:object}}
 */
export function useLiftZone(onDrop, { release = (x, y) => [x, y] } = {}) {
  const [lift, setLift] = useState(null);
  const [over, setOver] = useState(null);

  const api = {
    start(payload, ghost, { grabX, grabY, x, y }, width) {
      setLift({ payload, ghost, grabX, grabY, x, y, width });
    },
    move(x, y) {
      setLift(l => (l ? { ...l, x, y } : l));
      setOver(targetAt(x, y));
    },
    end(payload, { x, y, vx, vy, cancelled }) {
      // The ghost has to go before the hit test, or the pointer finds the
      // ghost instead of what is underneath it.
      setLift(null);
      setOver(null);
      if (cancelled) return;
      /* The throw picks the target when it lands on one. When it does not -
         the projection sailed off the edge of a scrolling board, or over a gap
         - where the finger actually let go wins. Losing the drop entirely
         because the physics overshot is the worst of both. */
      const target = targetAt(...release(x, y, vx, vy)) ?? targetAt(x, y);
      if (target) onDrop(payload, target);
    }
  };

  return { lift, over, api };
}

/** Something that can be picked up. A short press that never passes the drag
    threshold is still a click, so one element can be both. */
export function Liftable({ zone, payload, ghost, as: Tag = 'button', onClick, children, ...rest }) {
  const ref = useRef(null);
  const moved = useRef(false);

  const { onPointerDown } = useDrag({
    onStart: e => {
      moved.current = true;
      // Nothing passed a ghost? Carry what is written on the thing itself.
      zone.api.start(payload, ghost ?? ref.current?.textContent, e,
                     ref.current?.getBoundingClientRect().width);
    },
    onMove: ({ x, y }) => zone.api.move(x, y),
    onEnd: e => zone.api.end(payload, e)
  });

  return (
    <Tag
      ref={ref}
      type={Tag === 'button' ? 'button' : undefined}
      onPointerDown={e => { moved.current = false; onPointerDown(e); }}
      onClick={() => { if (!moved.current) onClick?.(); }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** What is actually in the air. In a portal so no parent's overflow or stacking
    context can clip it half way across the screen. */
export function LiftGhost({ lift }) {
  if (!lift) return null;
  return createPortal(
    <div className="jc-lift" style={{
      left: lift.x - lift.grabX, top: lift.y - lift.grabY,
      width: lift.width ? Math.min(lift.width, 300) : undefined
    }}>
      {lift.ghost}
    </div>,
    document.body
  );
}
