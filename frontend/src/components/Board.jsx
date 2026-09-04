import { useState } from 'react';
import { bucketColor } from '../useBuckets.js';

const hot = l => l === 'OVERDUE' || l === 'DUE TODAY' || l === 'SOS';
const warn = l => l === 'DUE SOON' || l === 'TOMORROW';

/* Buckets as columns. Native HTML5 drag-and-drop, same as the calendar - the
   column a card lands in is the bucket it gets. */
export default function Board({ tasks, buckets, onAssign, onOpen }) {
  const [over, setOver] = useState(null);

  const columns = [
    { id: 'none', name: 'Bina bucket', color: null },
    ...buckets.map(b => ({ id: b.id, name: b.name, color: bucketColor(b) }))
  ];

  const drop = (e, columnId) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onAssign(id, columnId === 'none' ? null : columnId);
  };

  return (
    <div className="board">
      {columns.map(col => {
        const cards = tasks.filter(t => (t.bucket_id || 'none') === col.id);
        return (
          <section key={col.id}
                   className={'bcol' + (over === col.id ? ' over' : '')}
                   onDragOver={e => { e.preventDefault(); setOver(col.id); }}
                   onDragLeave={() => setOver(o => (o === col.id ? null : o))}
                   onDrop={e => drop(e, col.id)}>
            <header>
              {col.color && <i style={{ background: col.color }} />}
              <span>{col.name}</span>
              <b>{cards.length}</b>
            </header>
            <div className="bcards">
              {cards.map(t => (
                <article key={t.id} draggable
                         onDragStart={e => e.dataTransfer.setData('text/plain', t.id)}>
                  <button className="ctitle" onClick={() => onOpen(t.id)}>{t.title}</button>
                  <div className="rmeta">
                    <span className={'tag' + (hot(t.label) ? ' hot' : warn(t.label) ? ' warn' : '')}>{t.label}</span>
                    {t.owner && <span className="tag">@{t.owner}</span>}
                  </div>
                </article>
              ))}
              {!cards.length && <p className="bempty">khaali</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
