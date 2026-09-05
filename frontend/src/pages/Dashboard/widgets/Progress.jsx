import { useEffect, useState } from 'react';
import { api } from '../../../shared/api.js';

/* A single ratio against a limit - a meter, not a chart. The target is the
   user's own number; without one it falls back to done vs everything. */
export default function Progress({ widget }) {
  const target = Number(widget.config?.target) || 0;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get('/stats?groupBy=status&scope=all&range=this_month')
      .then(d => alive && setData(d))
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  if (error) return <div className="w-msg">{error}</div>;
  if (!data) return <div className="w-msg">Loading…</div>;

  const done = data.groups.find(g => g.key === 'Done')?.value || 0;
  const goal = target || data.total || 1;
  const pct = Math.min(100, Math.round((done / goal) * 100));

  return (
    <div className="w-progress">
      <strong>{done} <span>/ {goal}</span></strong>
      <div className="track"><div className="fill" style={{ width: pct + '%' }} /></div>
      <span className="cap">{widget.config?.title || 'Completed this month'} · {pct}%</span>
    </div>
  );
}
