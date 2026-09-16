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
 * @returns {{lift:object|null, over:string|null, api:object}}
 */
export function useLiftZone(onDrop) {
  const [lift, setLift] = useState(null);
  const [over, setOver] = useState(null);

  const api = {
    start(payload, label, { grabX, grabY, x, y }, width) {
      setLift({ payload, label, grabX, grabY, x, y, width });
    },
    move(x, y) {
      setLift(l => (l ? { ...l, x, y } : l));
      setOver(targetAt(x, y));
    },
    end(payload, { x, y, cancelled }) {
      // The ghost has to go before the hit test, or the pointer finds the
      // ghost instead of what is underneath it.
      setLift(null);
      setOver(null);
      if (cancelled) return;
      const target = targetAt(x, y);
      if (target) onDrop(payload, target);
    }
  };

  return { lift, over, api };
}

/** Something that can be picked up. A short press that never passes the drag
    threshold is still a click, so one element can be both. */
export function Liftable({ zone, payload, label, as: Tag = 'button', onClick, children, ...rest }) {
  const ref = useRef(null);
  const moved = useRef(false);

  const { onPointerDown } = useDrag({
    onStart: e => {
      moved.current = true;
      zone.api.start(payload, label, e, ref.current?.getBoundingClientRect().width);
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
      width: lift.width ? Math.min(lift.width, 260) : undefined
    }}>
      {lift.label}
    </div>,
    document.body
  );
}
