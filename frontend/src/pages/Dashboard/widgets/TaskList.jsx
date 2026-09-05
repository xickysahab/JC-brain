import { useEffect, useState } from 'react';
import { api } from '../../../shared/api.js';
import { tagClass } from '../../../shared/urgency.js';


export default function TaskList({ widget }) {
  const view = widget.config?.view || 'open';
  const limit = Number(widget.config?.limit) || 8;
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get(`/tasks?view=${encodeURIComponent(view)}`)
      .then(d => alive && setTasks(d.tasks))
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, [view]);

  if (error) return <div className="w-msg">{error}</div>;
  if (!tasks) return <div className="w-msg">Loading…</div>;
  if (!tasks.length) return <div className="w-msg">Nothing in this view</div>;

  return (
    <ul className="w-list">
      {tasks.slice(0, limit).map(t => (
        <li key={t.id}>
          <span className="t">{t.title}</span>
          <span className={tagClass(t.label)}>{t.label}</span>
        </li>
      ))}
    </ul>
  );
}
