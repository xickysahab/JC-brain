import { widgetDef } from './widgets/index.jsx';

/* Renders a widget's config from its declarative `settings` list, so a new
   option is one line in the registry rather than a new panel. Sits under the
   toolbar instead of floating over the canvas - no popover to position, and it
   never covers the widget being configured. */
export default function WidgetSettings({ widget, options, onChange, onClose }) {
  const def = widgetDef(widget.type);
  if (!def.settings?.length) return null;

  const config = { ...(def.defaults || {}), ...(widget.config || {}) };
  const set = (key, value) => onChange({ ...config, [key]: value === '' ? undefined : value });

  const choicesFor = f => f.options
    ? f.options
    : (options?.[f.from] || []).map(o => [o.key, o.label]);

  return (
    <div className="wsettings">
      <span className="wsname">{def.label}</span>
      {def.settings.map(f => (
        <label key={f.key}>
          {f.label}
          {f.type === 'text' ? (
            <input value={config[f.key] ?? ''} placeholder="—"
                   onChange={e => set(f.key, e.target.value)} />
          ) : (
            <select value={config[f.key] ?? ''} onChange={e => set(f.key, e.target.value)}>
              {choicesFor(f).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
        </label>
      ))}
      <span className="grow" />
      <button className="btn sm" onClick={onClose}>Done</button>
    </div>
  );
}
