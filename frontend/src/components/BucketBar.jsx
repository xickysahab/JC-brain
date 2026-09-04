import { useState } from 'react';
import { bucketColor } from '../useBuckets.js';
import { Plus, Settings, Edit2, Trash2, Check } from 'lucide-react';

/* The bucket strip: filter in list mode, and the place buckets are created,
   renamed and deleted. Deleting one never deletes its tasks - they go back to
   the triage pile, which is what the confirm text promises. */
export default function BucketBar({ store, selected, onSelect, showCounts = true }) {
  const { buckets, unbucketed, create, rename, remove, error, clearError } = store;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [managing, setManaging] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await create(name)) { setName(''); setAdding(false); }
  };

  const doRename = async b => {
    const next = prompt(`Rename "${b.name}" to:`, b.name);
    if (next && next.trim() && next !== b.name) await rename(b.id, next);
  };
  const doRemove = async b => {
    if (!confirm(`Delete the "${b.name}" bucket?\n\nIts ${b.task_count} task(s) will not be deleted — they move back to Uncategorised.`)) return;
    await remove(b.id);
  };

  return (
    <div className="bucketbar">
      {error && <div className="err" style={{ width: '100%' }} onClick={clearError}>{error}</div>}

      <button className={'bchip' + (selected === null ? ' on' : '')} onClick={() => onSelect(null)}>
        All{showCounts && buckets.length > 0 && <b>{buckets.reduce((n, b) => n + Number(b.open_count), 0) + unbucketed}</b>}
      </button>

      {buckets.map(b => (
        <span key={b.id} className="bwrap">
          <button className={'bchip' + (selected === b.id ? ' on' : '')} onClick={() => onSelect(b.id)}>
            <i style={{ background: bucketColor(b) }} />
            {b.name}
            {showCounts && <b>{b.open_count}</b>}
          </button>
          {managing && (
            <span className="bmenu">
              <button title="Rename" onClick={() => doRename(b)}><Edit2 size={12} /></button>
              <button title="Delete" className="danger" onClick={() => doRemove(b)}><Trash2 size={12} /></button>
            </span>
          )}
        </span>
      ))}

      {unbucketed > 0 && (
        <button className={'bchip loose' + (selected === 'none' ? ' on' : '')} onClick={() => onSelect('none')}>
          Uncategorised <b>{unbucketed}</b>
        </button>
      )}

      {adding ? (
        <form className="badd" style={{ marginLeft: 'auto' }} onSubmit={submit}>
          <input autoFocus value={name} maxLength={40} placeholder="Bucket name"
                 onChange={e => setName(e.target.value)}
                 onKeyDown={e => e.key === 'Escape' && setAdding(false)} />
          <button className="btn sm primary">Create</button>
          <button type="button" className="btn sm" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="bchip ghost" title="New bucket" onClick={() => setAdding(true)}>
            <Plus size={16} />
          </button>
          {buckets.length > 0 && (
            <button className="bchip ghost" title={managing ? 'Done managing' : 'Manage buckets'} onClick={() => setManaging(m => !m)}>
              {managing ? <Check size={16} /> : <Settings size={16} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
