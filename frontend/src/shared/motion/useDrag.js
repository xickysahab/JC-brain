import { useCallback, useRef, useState } from 'react';
import { velocityTracker } from './spring.js';

/* One dragging primitive for the whole app.

   It exists because the browser's own drag-and-drop cannot do any of the
   things that make dragging feel real: the drag image is the browser's, the
   position is quantised, there is no velocity, and the gesture cannot be
   interrupted. Everything here is Pointer Events instead.

   What it guarantees to every caller:
     - the grab offset is respected, so the thing does not jump to centre
       itself under the finger the instant it is picked up;
     - capture, so a fast drag that outruns the pointer is not dropped the
       moment it leaves the element;
     - a movement threshold before anything is called a drag, so a click
       stays a click;
     - a release velocity measured over a window, for the handover;
     - Escape cancels, because a gesture you cannot back out of is a trap. */
export function useDrag({ onStart, onMove, onEnd, threshold = 6, enabled = true } = {}) {
  const [dragging, setDragging] = useState(false);
  const live = useRef(null);

  const finish = useCallback((cancelled) => {
    const s = live.current;
    if (!s) return;
    live.current = null;
    setDragging(false);

    s.el.removeEventListener('pointermove', s.move);
    s.el.removeEventListener('pointerup', s.up);
    s.el.removeEventListener('pointercancel', s.up);
    window.removeEventListener('keydown', s.key);
    try { s.el.releasePointerCapture(s.pointerId); } catch { /* already gone */ }

    // A gesture that never passed the threshold was a click; the caller was
    // never told it started, so it is not told it ended either.
    if (!s.moved) return;
    const v = cancelled ? { vx: 0, vy: 0 } : s.track.read();
    onEnd?.({ ...s.last, ...v, cancelled });
  }, [onEnd]);

  const onPointerDown = useCallback(e => {
    if (!enabled || e.button !== 0 || live.current) return;

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const track = velocityTracker();
    track.add(e.clientX, e.clientY, e.timeStamp);

    const s = {
      el, pointerId: e.pointerId, track, moved: false,
      startX: e.clientX, startY: e.clientY,
      grabX: e.clientX - rect.left, grabY: e.clientY - rect.top,
      width: rect.width, height: rect.height,
      last: { dx: 0, dy: 0, x: e.clientX, y: e.clientY }
    };

    s.move = ev => {
      const dx = ev.clientX - s.startX, dy = ev.clientY - s.startY;
      if (!s.moved) {
        if (Math.hypot(dx, dy) < threshold) return;
        s.moved = true;
        setDragging(true);
        onStart?.({ x: s.startX, y: s.startY, grabX: s.grabX, grabY: s.grabY,
                    width: s.width, height: s.height });
      }
      track.add(ev.clientX, ev.clientY, ev.timeStamp);
      s.last = { dx, dy, x: ev.clientX, y: ev.clientY,
                 grabX: s.grabX, grabY: s.grabY, width: s.width, height: s.height };
      onMove?.(s.last);
    };
    s.up = () => finish(false);
    s.key = ev => { if (ev.key === 'Escape') finish(true); };

    live.current = s;
    el.setPointerCapture(e.pointerId);
    el.addEventListener('pointermove', s.move);
    el.addEventListener('pointerup', s.up);
    el.addEventListener('pointercancel', s.up);
    window.addEventListener('keydown', s.key);
  }, [enabled, threshold, onStart, onMove, finish]);

  return { dragging, onPointerDown };
}
