import { widgetDef } from './index.jsx';

export default function Placeholder({ widget }) {
  return (
    <div className="w-soon">
      <strong>{widgetDef(widget.type).label}</strong>
      <span>Coming soon</span>
      {widget.config?.chart && <code>{widget.config.chart} · by {widget.config.groupBy}</code>}
    </div>
  );
}
