import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../shared/api.js';
import Canvas from './Canvas.jsx';
import WidgetSettings from './WidgetSettings.jsx';
import { useHistory } from './useHistory.js';
import { WIDGETS, widgetDef } from './widgets/index.jsx';
import { Save, X, Undo2, Redo2, Plus, RotateCcw, PenTool } from 'lucide-react';
import DialogModal from '../../shared/DialogModal.jsx';
import './Dashboard.css';

const BREAKPOINT = 'desktop';   // the mobile layout gets its own editor in P5

export default function Dashboard() {
  const { widgets, canUndo, canRedo, begin, end, set, undo, redo, reset } = useHistory([]);
  const [editing, setEditing] = useState(false);
  const [snap, setSnap] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState('loading');   // loading | ready | saving
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState(null);
  const [dialog, setDialog] = useState(null);
  const dirty = useRef(false);

  // What the chart config panel can offer, straight from the API that does the
  // grouping - so the two can never drift.
  useEffect(() => { api.get('/stats/options').then(setOptions).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setStatus('loading'); setError('');
    try {
      const d = await api.get(`/dashboard?breakpoint=${BREAKPOINT}`);
      reset(d.widgets); setIsDefault(d.isDefault); dirty.current = false;
    } catch (e) { setError(e.message); } finally { setStatus('ready'); }
  }, [reset]);
  useEffect(() => { load(); }, [load]);

  const change = updater => { dirty.current = true; set(updater); };

  const save = async () => {
    setStatus('saving'); setError('');
    try {
      const d = await api.put('/dashboard', { breakpoint: BREAKPOINT, widgets });
      reset(d.widgets); setIsDefault(false); dirty.current = false; setEditing(false); setSelectedId(null);
    } catch (e) { setError(e.message); } finally { setStatus('ready'); }
  };

  const cancel = () => { setEditing(false); setSelectedId(null); load(); };

  const resetLayout = () => {
    setDialog({
      type: 'confirm',
      title: 'Reset Layout',
      description: 'Reset to the default layout? Your arrangement will be lost.',
      danger: true,
      confirmLabel: 'Reset',
      onConfirm: async () => {
        try {
          const d = await api.del(`/dashboard?breakpoint=${BREAKPOINT}`);
          reset(d.widgets); setIsDefault(true); dirty.current = false;
        } catch (e) { setError(e.message); }
        setDialog(null);
      }
    });
  };

  const addWidget = type => {
    const { size, defaults } = widgetDef(type);
    // Stagger new widgets so two in a row do not land exactly on top of each other.
    const offset = (widgets.length % 6) * 28;
    const id = `w-${type}-${Date.now().toString(36)}`;
    change(list => [...list, {
      id, type, x: 40 + offset, y: 40 + offset, w: size.w, h: size.h,
      z: Math.max(1, ...list.map(w => w.z)) + 1, config: { ...(defaults || {}) }
    }]);
    setSelectedId(id);
    setPicking(false);
  };

  const removeWidget = id => {
    change(list => list.filter(w => w.id !== id));
    setSelectedId(s => (s === id ? null : s));
  };

  const changeConfig = (id, config) =>
    change(list => list.map(w => (w.id === id ? { ...w, config } : w)));

  // Ctrl/Cmd+Z and Shift+Z, but only while editing.
  useEffect(() => {
    if (!editing) return;
    const onKey = e => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, undo, redo]);

  // Leaving with unsaved changes loses them; the browser prompt is the only
  // hook that fires for a tab close as well as a reload.
  useEffect(() => {
    const warn = e => { if (editing && dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing]);

  const selected = widgets.find(w => w.id === selectedId) || null;

  return (
    <>
      <div className="head">
        <h1>Dashboard</h1>
        <p>
          {editing
            ? 'Drag to move, pull the corner to resize, select a widget to change its settings. Arrow keys nudge, Delete removes, ⌘Z undoes.'
            : isDefault ? 'This is the starting layout — choose “Edit layout” to make it yours.' : 'Your saved layout.'}
        </p>
      </div>

      <div className="canvasbar">
        {editing ? (
          <>
            <button className="btn primary" onClick={save} disabled={status === 'saving'}>
              <Save size={16} /> {status === 'saving' ? 'Saving…' : 'Save'}
            </button>
            <button className="btn" onClick={cancel}>
              <X size={16} /> Cancel
            </button>
            <span className="sep" />
            <button className="btn" onClick={() => setPicking(p => !p)} aria-expanded={picking}>
              <Plus size={16} /> Add widget
            </button>
            <button className="btn" onClick={undo} disabled={!canUndo} title="⌘Z">
              <Undo2 size={16} />
            </button>
            <button className="btn" onClick={redo} disabled={!canRedo} title="⇧⌘Z">
              <Redo2 size={16} />
            </button>
            <label className="snap">
              <input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} /> Snap
            </label>
            <span className="grow" />
            <button className="btn danger" onClick={resetLayout}>
              <RotateCcw size={16} /> Reset
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" onClick={() => setEditing(true)}>
              <PenTool size={16} /> Edit layout
            </button>
            <span className="muted">{widgets.length} widget{widgets.length === 1 ? '' : 's'}</span>
          </>
        )}
      </div>

      {picking && editing && (
        <div className="picker">
          {Object.entries(WIDGETS).map(([type, def]) => (
            <button key={type} className="pick" onClick={() => addWidget(type)}>
              <b>{def.label}</b>
              {def.soon && <span>P4</span>}
            </button>
          ))}
        </div>
      )}

      {editing && selected && (
        <WidgetSettings
          widget={selected}
          options={options}
          onChange={config => changeConfig(selected.id, config)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {error && <div className="err">{error}</div>}
      {status === 'loading' ? <div className="skel" style={{ height: 320 }} /> : (
        <Canvas
          widgets={widgets}
          editing={editing}
          snap={snap}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={change}
          onBegin={begin}
          onEnd={end}
          onRemove={removeWidget}
          onConfigChange={changeConfig}
        />
      )}
      <DialogModal dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
