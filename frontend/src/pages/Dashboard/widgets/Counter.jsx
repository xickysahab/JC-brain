import { useEffect, useState } from 'react';
import { api } from '../../../shared/api.js';

const LABELS = { open: 'Open', overdue: 'Overdue', today: 'Due today', sos: 'SOS' };
const TONE = { overdue: 'hot', sos: 'hot', today: 'warn', open: '' };

export default function Counter({ widget }) {
  const metric = LABELS[widget.config?.metric] ? widget.config.metric : 'open';
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get('/tasks/counts')
      .then(d => alive && setCounts(d))
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  if (error) return <div className="w-msg">{error}</div>;
  return (
    <div className={'w-counter ' + TONE[metric]}>
      <strong>{counts ? counts[metric] ?? 0 : '—'}</strong>
      <span>{LABELS[metric]}</span>
    </div>
  );
}
