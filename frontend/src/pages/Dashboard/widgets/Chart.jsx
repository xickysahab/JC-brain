import { useEffect, useState } from 'react';
import { api } from '../../../shared/api.js';
import { Pie, Bars, Line, Table, Legend, fold, MAX_SLICES } from './charts.jsx';

const FORMS = {
  pie:   (p) => <Pie {...p} />,
  donut: (p) => <Pie {...p} donut />,
  bar:   (p) => <Bars {...p} />,
  hbar:  (p) => <Bars {...p} horizontal />,
  line:  (p) => <Line {...p} />,
  table: (p) => <Table {...p} />
};

export default function Chart({ widget }) {
  const c = widget.config || {};
  const form = FORMS[c.chart] ? c.chart : 'pie';
  const groupBy = c.groupBy || 'status';
  const scope = c.scope || 'open';
  const range = c.range || 'all';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null); setError('');
    const q = new URLSearchParams({ groupBy, scope, range });
    api.get(`/stats?${q}`)
      .then(d => alive && setData(d))
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, [groupBy, scope, range]);

  if (error) return <div className="w-msg">{error}</div>;
  if (!data) return <div className="w-msg">Loading…</div>;
  if (!data.groups.length) return <div className="w-msg">No tasks match this filter</div>;

  const shown = fold(data.groups, MAX_SLICES[form]);

  return (
    <div className="chart">
      {c.title && <div className="chart-title">{c.title}</div>}
      <div className="chart-body">{FORMS[form]({ data: shown, total: data.total })}</div>
      {form !== 'table' && <Legend data={shown} total={data.total} />}
    </div>
  );
}
