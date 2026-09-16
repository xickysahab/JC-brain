import { useEffect, useRef } from 'react';
import WidgetFrame, { MIN_W, MIN_H } from './WidgetFrame.jsx';
import { widgetDef } from './widgets/index.jsx';
import { resist } from '../../shared/motion/spring.js';

/* A key event dispatched on window has no .matches; guard before asking. */
const isField = el => el instanceof Element && el.matches('input, textarea, select, [contenteditable]');

const SNAP = 8;
/* How hard the edge pushes back. Measured against a typical widget rather
   than the viewport, so the resistance feels the same on any screen. */
const EDGE = 420;
const snapTo = (v, on) => (on ? Math.round(v / SNAP) * SNAP : Math.round(v));

/* The free canvas. Widgets are absolutely positioned, may overlap, and carry
   their own z-order. Nothing here knows what a widget renders - that is the
   registry's job - so a new widget type needs no change in this file. */
export default function Canvas({
  widgets, editing, snap, selectedId, onSelect,
  onChange, onBegin, onEnd, onRemove, onConfigChange
}) {
  const ref = useRef(null);

  const patch = (id, fields) => onChange(list => list.map(w => (w.id === id ? { ...w, ...fields } : w)));

  /* Two modes on purpose.

     Live, the widget follows the pointer exactly and the edge resists instead
     of stopping - a hard stop at x=0 reads as frozen, and snapping to a grid
     mid-drag means the thing under your finger is not where your finger is.

     Committed, it snaps and clamps. Aiming happens while you can see it; the
     tidying happens when you let go. */
  const liveGeometry = g => ({
    ...('x' in g ? { x: resist(g.x, 0, Infinity, EDGE) } : {}),
    ...('y' in g ? { y: resist(g.y, 0, Infinity, EDGE) } : {}),
    ...('w' in g ? { w: Math.max(MIN_W, g.w) } : {}),
    ...('h' in g ? { h: Math.max(MIN_H, g.h) } : {})
  });

  /* Where a gesture's result belongs once it is over. The frame asks for this
     so its spring knows what to aim at - only the canvas knows whether the
     grid is on. */
  const resolveGeometry = g => ({
    ...('x' in g ? { x: Math.max(0, snapTo(g.x, snap)) } : {}),
    ...('y' in g ? { y: Math.max(0, snapTo(g.y, snap)) } : {}),
    ...('w' in g ? { w: Math.max(MIN_W, snapTo(g.w, snap)) } : {}),
    ...('h' in g ? { h: Math.max(MIN_H, snapTo(g.h, snap)) } : {})
  });

  const setGeometry = (id, g, live = false) => patch(id, live ? liveGeometry(g) : resolveGeometry(g));

  const zRange = () => widgets.reduce(
    (a, w) => ({ min: Math.min(a.min, w.z), max: Math.max(a.max, w.z) }),
    { min: 1, max: 1 }
  );
  const toFront = id => patch(id, { z: zRange().max + 1 });
  const toBack = id => patch(id, { z: Math.max(0, zRange().min - 1) });

  /* Keyboard nudging: the only way to place a widget precisely without
     fighting the mouse. Shift moves by a bigger step. */
  useEffect(() => {
    if (!editing || !selectedId) return;
    const onKey = e => {
      if (isField(e.target)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(selectedId); return; }
      const step = e.shiftKey ? 20 : snap ? SNAP : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!delta) return;
      e.preventDefault();
      const w = widgets.find(x => x.id === selectedId);
      if (w) setGeometry(selectedId, { x: w.x + delta[0], y: w.y + delta[1] });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Grow with the content so a widget dragged downward is never unreachable.
  const height = Math.max(560, ...widgets.map(w => w.y + w.h + 120));

  return (
    <div
      ref={ref}
      className={'canvas' + (editing ? ' editing' : '') + (snap && editing ? ' snapped' : '')}
      style={{ height }}
      onPointerDown={() => editing && onSelect(null)}
    >
      {widgets.map(w => {
        const { Component } = widgetDef(w.type);
        return (
          <WidgetFrame
            key={w.id}
            widget={w}
            editing={editing}
            selected={selectedId === w.id}
            onSelect={onSelect}
            onGeometry={setGeometry}
            onResolve={resolveGeometry}
            onBegin={onBegin}
            onEnd={onEnd}
            onRemove={onRemove}
            onFront={toFront}
            onBack={toBack}
          >
            <Component
              widget={w}
              editing={editing}
              onConfigChange={config => onConfigChange(w.id, config)}
            />
          </WidgetFrame>
        );
      })}

      {!widgets.length && (
        <div className="canvas-empty">
          <strong>Nothing on the canvas</strong>
          {editing ? 'Add a widget from the toolbar above.' : 'Choose “Edit layout” to start adding widgets.'}
        </div>
      )}
    </div>
  );
}
