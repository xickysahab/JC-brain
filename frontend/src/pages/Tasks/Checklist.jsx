import { useState } from 'react';
import { Plus, X } from 'lucide-react';

/* The steps inside one task.

   Everything is one keystroke: type and press Enter for the next step, click
   the box to tick one off. Leaving the field with text still in it adds that
   step too - half a thought typed and then abandoned is still a thought. */
export default function Checklist({ items, onChange }) {
  const [text, setText] = useState('');
  const list = Array.isArray(items) ? items : [];
  const done = list.filter(i => i.done).length;

  const add = () => {
    const title = text.trim();
    if (!title) return;
    onChange([...list, { id: `n${Date.now()}-${list.length}`, title, done: false }]);
    setText('');
  };
  const patch = (id, next) => onChange(list.map(i => (i.id === id ? { ...i, ...next } : i)));

  return (
    <div className="checklist">
      {list.length > 0 && (
        <div className="clhead">
          <div className="clbar"><i style={{ width: `${(done / list.length) * 100}%` }} /></div>
          <span className="clcount">{done}/{list.length}</span>
        </div>
      )}

      {list.map(i => (
        <div className={'clrow' + (i.done ? ' done' : '')} key={i.id}>
          <input type="checkbox" className="apple-checkbox" checked={i.done}
                 onChange={e => patch(i.id, { done: e.target.checked })}
                 aria-label={i.title} />
          <input className="cltext" value={i.title}
                 onChange={e => patch(i.id, { title: e.target.value })} />
          <button type="button" className="clx" aria-label={`Remove ${i.title}`}
                  onClick={() => onChange(list.filter(x => x.id !== i.id))}>
            <X size={13} />
          </button>
        </div>
      ))}

      <div className="clrow clnew">
        <Plus size={14} />
        <input className="cltext" value={text} placeholder="Add a step…"
               aria-label="Add a step"
               onChange={e => setText(e.target.value)}
               onBlur={add}
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      </div>
    </div>
  );
}
