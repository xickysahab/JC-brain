import { useEffect, useRef, useState } from 'react';
import { widgetDef } from './widgets/index.jsx';
import { useDrag } from '../../shared/motion/useDrag.js';
import { springTo } from '../../shared/motion/spring.js';

export const MIN_W = 120, MIN_H = 80;   // must match LIMITS in backend/src/layout.js

/* One widget on the canvas: its chrome, and the two gestures that move and
   resize it.

   The widget tracks the pointer exactly while the gesture is live - no grid,
   no clamping, just the finger - and settles onto the grid when it is let go,
   carrying the speed it was moving at. That handover is the whole trick: the
   drag and the settle are one continuous motion rather than a drag followed
   by an animation.

   The layout is committed the instant the finger lifts. The settle is only a
   transform on top of the committed position, so a tab that is backgrounded
   mid-spring - where the frame clock all but stops - still ends up with the
   widget exactly where it was dropped, just without the travel.

   Momentum is deliberately *not* projected here. A flick should land where it
   was thrown only when there is something to land on; free placement has no
   targets, so throwing a widget across the canvas would be a bug wearing a
   physics costume. The board and the calendar do project, because they have
   columns and days to aim at. */
export default function WidgetFrame({
  widget, editing, selected, onSelect, onGeometry, onResolve, onBegin, onEnd,
  onRemove, onFront, onBack, children
}) {
  const def = widgetDef(widget.type);
  const origin = useRef(null);

  /* How far the widget is drawn from where it now officially lives. Decays to
     zero on a spring; the committed position never depends on it. */
  const [offset, setOffset] = useState(null);
  const running = useRef([]);
  const stopSprings = () => { running.current.forEach(a => a.stop()); running.current = []; };
  useEffect(() => stopSprings, []);

  const gesture = mode => ({
    enabled: editing,
    onStart: () => {
      // Grabbing something that is still settling takes it over mid-flight
      // rather than queueing behind it.
      stopSprings();
      setOffset(null);
      origin.current = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
      onSelect(widget.id);
      onBegin();
    },
    onMove: ({ dx, dy }) => {
      const o = origin.current;
      onGeometry(widget.id, mode === 'move' ? { x: o.x + dx, y: o.y + dy }
                                            : { w: o.w + dx, h: o.h + dy }, true);
    },
    onEnd: ({ dx, dy, vx, vy, cancelled }) => {
      const o = origin.current;
      if (cancelled) { onGeometry(widget.id, o); onEnd(); return; }

      // Resizing has nothing to fly to: it is committed where the corner was
      // let go, and the minimum was already being enforced live.
      if (mode !== 'move') {
        onGeometry(widget.id, { w: o.w + dx, h: o.h + dy });
        onEnd();
        return;
      }

      // Where it is drawn right now (already rubber-banded), and where it
      // belongs. Only the canvas knows the second answer - it owns the grid.
      const shown = { x: widget.x, y: widget.y };
      const target = onResolve({ x: o.x + dx, y: o.y + dy });

      onGeometry(widget.id, target);
      onEnd();

      const from = { x: shown.x - target.x, y: shown.y - target.y };
      if (Math.abs(from.x) < 0.5 && Math.abs(from.y) < 0.5) return;

      /* One spring per axis: a single spring over 2D distance desynchronises
         the moment x and y are moving at different speeds. */
      setOffset(from);
      running.current = [
        springTo({ from: from.x, to: 0, velocity: vx, damping: 1, response: 0.4,
                   onUpdate: x => setOffset(p => ({ ...(p || from), x })) }),
        springTo({ from: from.y, to: 0, velocity: vy, damping: 1, response: 0.4,
                   onUpdate: y => setOffset(p => ({ ...(p || from), y })),
                   onRest: () => setOffset(null) })
      ];
    }
  });

  const move = useDrag(gesture('move'));
  const resize = useDrag(gesture('resize'));

  const stop = e => e.stopPropagation();

  return (
    <div
      className={'wframe' + (editing ? ' editing' : '') + (selected ? ' selected' : '')
                 + (move.dragging || resize.dragging ? ' grabbed' : '')}
      style={{
        left: widget.x, top: widget.y, width: widget.w, height: widget.h, zIndex: widget.z,
        transform: offset ? `translate3d(${offset.x}px, ${offset.y}px, 0)` : undefined
      }}
      onPointerDown={move.onPointerDown}
      role={editing ? 'button' : undefined}
      aria-label={editing ? `${def.label} widget` : undefined}
    >
      {editing && (
        <div className="wbar">
          <span className="wname">{def.label}</span>
          <button className="wbtn" title="Bring to front" onPointerDown={stop} onClick={() => onFront(widget.id)}>&#9633;&#8593;</button>
          <button className="wbtn" title="Send to back"  onPointerDown={stop} onClick={() => onBack(widget.id)}>&#9633;&#8595;</button>
          <button className="wbtn danger" title="Remove" onPointerDown={stop} onClick={() => onRemove(widget.id)}>&times;</button>
        </div>
      )}

      {/* In edit mode the body ignores the pointer so a drag never lands inside
          a chart or a list instead of moving the widget. */}
      <div className="wbody" style={editing ? { pointerEvents: 'none' } : undefined}>
        {children}
      </div>

      {editing && (
        <span className="whandle" title="Resize" onPointerDown={resize.onPointerDown} />
      )}
    </div>
  );
}
