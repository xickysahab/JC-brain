import { useState } from 'react';
import { useSize } from '../useSize.js';

/* Hand-drawn SVG charts. Categorical colours come from --series-1..8, assigned
   in fixed order and never cycled: past the cap the tail folds into a neutral
   "Other" slice rather than reusing a hue that already means something else. */

export const MAX_SLICES = { pie: 6, donut: 6, bar: 8, hbar: 8, line: 60, table: 50 };

export function fold(groups, max) {
  if (groups.length <= max) return groups.map((g, i) => ({ ...g, slot: i }));
  const head = groups.slice(0, max - 1).map((g, i) => ({ ...g, slot: i }));
  const rest = groups.slice(max - 1);
  return [...head, {
    key: '__other', label: `Other (${rest.length})`, slot: -1,
    value: rest.reduce((n, g) => n + g.value, 0)
  }];
}

const colour = slot => (slot < 0 ? 'var(--series-other)' : `var(--series-${(slot % 8) + 1})`);

/* One tooltip for every chart form. Positioned against the wrapper, so it
   cannot be clipped by the SVG's own coordinate space. */
function useTip() {
  const [tip, setTip] = useState(null);
  const bind = (label, value, total) => ({
    onPointerEnter: e => setTip({
      label, value, total,
      x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY
    }),
    onPointerLeave: () => setTip(null)
  });
  const node = tip && (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>
      <b>{tip.label}</b>
      <span>{tip.value}{tip.total ? ` · ${Math.round((tip.value / tip.total) * 100)}%` : ''}</span>
    </div>
  );
  return [bind, node];
}

export function Legend({ data, total }) {
  if (data.length < 2) return null;      // one series needs no legend; the title names it
  return (
    <ul className="chart-legend">
      {data.map(d => (
        <li key={d.key}>
          <i style={{ background: colour(d.slot) }} />
          <span className="l">{d.label}</span>
          <b>{d.value}</b>
          {total > 0 && <em>{Math.round((d.value / total) * 100)}%</em>}
        </li>
      ))}
    </ul>
  );
}

const arc = (cx, cy, r, a0, a1) => {
  const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  const [x0, y0] = p(a0, r), [x1, y1] = p(a1, r);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`;
};

export function Pie({ data, total, donut }) {
  const [ref, { w, h }] = useSize();
  const [bind, tip] = useTip();
  const size = Math.max(0, Math.min(w, h));
  const r = size / 2 - 4, cx = w / 2, cy = h / 2;
  let a = -Math.PI / 2;

  return (
    <div className="chart-wrap" ref={ref}>
      {size > 40 && (
        <svg width={w} height={h} role="img" aria-label="Share of tasks by group">
          {data.map(d => {
            const a0 = a, a1 = a + (d.value / total) * Math.PI * 2;
            a = a1;
            return (
              <path key={d.key} d={arc(cx, cy, r, a0, a1)} fill={colour(d.slot)}
                    stroke="var(--surface)" strokeWidth="2" {...bind(d.label, d.value, total)} />
            );
          })}
          {donut && <circle cx={cx} cy={cy} r={r * 0.58} fill="var(--surface)" />}
          {donut && (
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                  className="chart-center">{total}</text>
          )}
        </svg>
      )}
      {tip}
    </div>
  );
}

/** Rounded only on the data end, anchored flat to the baseline. */
const barPath = (x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h);
  return `M ${x} ${y + h} L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h} Z`;
};
const hbarPath = (x, y, w, h, r) => {
  const rr = Math.min(r, h / 2, w);
  return `M ${x} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h - rr} Q ${x + w} ${y + h} ${x + w - rr} ${y + h} L ${x} ${y + h} Z`;
};

export function Bars({ data, total, horizontal }) {
  const [ref, { w, h }] = useSize();
  const [bind, tip] = useTip();
  const max = Math.max(1, ...data.map(d => d.value));
  const pad = { t: 10, r: 10, b: 22, l: horizontal ? 92 : 26 };
  const iw = Math.max(0, w - pad.l - pad.r), ih = Math.max(0, h - pad.t - pad.b);
  const band = (horizontal ? ih : iw) / Math.max(1, data.length);
  const thick = Math.max(4, Math.min(horizontal ? 26 : 44, band - 8));

  return (
    <div className="chart-wrap" ref={ref}>
      {iw > 20 && ih > 20 && (
        <svg width={w} height={h} role="img" aria-label="Task counts by group">
          <line x1={pad.l} y1={pad.t + ih} x2={pad.l + iw} y2={pad.t + ih}
                stroke="currentColor" strokeOpacity=".2" />
          {data.map((d, i) => {
            const off = (horizontal ? pad.t : pad.l) + i * band + (band - thick) / 2;
            const len = (d.value / max) * (horizontal ? iw : ih);
            return horizontal ? (
              <g key={d.key} {...bind(d.label, d.value, total)}>
                <path d={hbarPath(pad.l, off, Math.max(2, len), thick, 4)} fill={colour(d.slot)} />
                <text x={pad.l - 8} y={off + thick / 2} textAnchor="end" dominantBaseline="central"
                      className="chart-axis">{String(d.label).slice(0, 14)}</text>
                <text x={pad.l + len + 6} y={off + thick / 2} dominantBaseline="central"
                      className="chart-value">{d.value}</text>
              </g>
            ) : (
              <g key={d.key} {...bind(d.label, d.value, total)}>
                <path d={barPath(off, pad.t + ih - len, thick, Math.max(2, len), 4)} fill={colour(d.slot)} />
                <text x={off + thick / 2} y={pad.t + ih + 14} textAnchor="middle"
                      className="chart-axis">{String(d.label).slice(0, 8)}</text>
                {len > 24 && (
                  <text x={off + thick / 2} y={pad.t + ih - len - 5} textAnchor="middle"
                        className="chart-value">{d.value}</text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {tip}
    </div>
  );
}

export function Line({ data }) {
  const [ref, { w, h }] = useSize();
  const [bind, tip] = useTip();
  const max = Math.max(1, ...data.map(d => d.value));
  const pad = { t: 12, r: 12, b: 22, l: 26 };
  const iw = Math.max(0, w - pad.l - pad.r), ih = Math.max(0, h - pad.t - pad.b);
  const at = i => pad.l + (data.length < 2 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = v => pad.t + ih - (v / max) * ih;
  const pts = data.map((d, i) => `${at(i)},${y(d.value)}`).join(' ');

  return (
    <div className="chart-wrap" ref={ref}>
      {iw > 20 && ih > 20 && (
        <svg width={w} height={h} role="img" aria-label="Task count over time">
          <line x1={pad.l} y1={pad.t + ih} x2={pad.l + iw} y2={pad.t + ih}
                stroke="currentColor" strokeOpacity=".2" />
          <polyline points={pts} fill="none" stroke="var(--series-1)" strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <circle key={d.key} cx={at(i)} cy={y(d.value)} r="4.5" fill="var(--series-1)"
                    stroke="var(--surface)" strokeWidth="2" {...bind(d.label, d.value)} />
          ))}
          {data.length > 1 && [data[0], data.at(-1)].map((d, k) => (
            <text key={k} x={k ? pad.l + iw : pad.l} y={pad.t + ih + 14}
                  textAnchor={k ? 'end' : 'start'} className="chart-axis">
              {String(d.label).slice(5)}
            </text>
          ))}
        </svg>
      )}
      {tip}
    </div>
  );
}

export function Table({ data, total }) {
  return (
    <div className="chart-table">
      <table>
        <tbody>
          {data.map(d => (
            <tr key={d.key}>
              <td><i style={{ background: colour(d.slot) }} />{d.label}</td>
              <td className="n">{d.value}</td>
              <td className="p">{total > 0 ? Math.round((d.value / total) * 100) + '%' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
