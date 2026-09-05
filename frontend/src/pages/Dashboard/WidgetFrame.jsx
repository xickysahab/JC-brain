import { widgetDef } from './widgets/index.jsx';

export const MIN_W = 120, MIN_H = 80;   // must match LIMITS in backend/src/layout.js

/* One widget on the canvas: its chrome, and the pointer handling for moving and
   resizing it. Geometry is reported upward on every pointermove; the parent
   decides what that means for history. */
export default function WidgetFrame({
  widget, editing, selected, onSelect, onGeometry, onBegin, onEnd,
  onRemove, onFront, onBack, children
}) {
  const def = widgetDef(widget.type);

  const startGesture = (e, mode) => {
    if (!editing || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(widget.id);
    onBegin();

    const s = { px: e.clientX, py: e.clientY, x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    const move = ev => {
      const dx = ev.clientX - s.px, dy = ev.clientY - s.py;
      onGeometry(widget.id, mode === 'move'
        ? { x: s.x + dx, y: s.y + dy }
        : { w: s.w + dx, h: s.h + dy });
    };
    // Listeners go on the window so a fast drag that outruns the pointer does
    // not drop the gesture the moment it leaves the widget.
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onEnd();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      className={'wframe' + (editing ? ' editing' : '') + (selected ? ' selected' : '')}
      style={{ left: widget.x, top: widget.y, width: widget.w, height: widget.h, zIndex: widget.z }}
      onPointerDown={e => startGesture(e, 'move')}
      role={editing ? 'button' : undefined}
      aria-label={editing ? `${def.label} widget` : undefined}
    >
      {editing && (
        <div className="wbar">
          <span className="wname">{def.label}</span>
          <button className="wbtn" title="Bring to front" onPointerDown={e => e.stopPropagation()} onClick={() => onFront(widget.id)}>&#9633;&#8593;</button>
          <button className="wbtn" title="Send to back"  onPointerDown={e => e.stopPropagation()} onClick={() => onBack(widget.id)}>&#9633;&#8595;</button>
          <button className="wbtn danger" title="Remove" onPointerDown={e => e.stopPropagation()} onClick={() => onRemove(widget.id)}>&times;</button>
        </div>
      )}

      {/* In edit mode the body ignores the pointer so a drag never lands inside
          a chart or a list instead of moving the widget. */}
      <div className="wbody" style={editing ? { pointerEvents: 'none' } : undefined}>
        {children}
      </div>

      {editing && (
        <span className="whandle" title="Resize" onPointerDown={e => startGesture(e, 'resize')} />
      )}
    </div>
  );
}
