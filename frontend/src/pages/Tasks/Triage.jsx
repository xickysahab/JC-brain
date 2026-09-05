import { bucketColor } from '../../shared/useBuckets.js';

/* The second half of "dump now, sort later": every loose task with the bucket
   chips right underneath it, so sorting twenty tasks is twenty clicks and no
   dialogs. */
export default function Triage({ tasks, buckets, onAssign, onOpen, busyId }) {
  if (!buckets.length) {
    return (
      <div className="empty">
        <strong>Create a bucket first</strong>
        Use &ldquo;New bucket&rdquo; above — Payments, Sales, Content, whatever your work actually is.
      </div>
    );
  }
  if (!tasks.length) {
    return (
      <div className="empty">
        <strong>Inbox zero</strong>
        Every task has a bucket.
      </div>
    );
  }

  return (
    <>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        {tasks.length} task{tasks.length === 1 ? '' : 's'} waiting to be sorted. Pick a bucket below — it files instantly.
      </p>
      {tasks.map(t => (
        <div key={t.id} className={'triage' + (busyId === t.id ? ' busy' : '')}>
          <button className="ttitle" onClick={() => onOpen(t.id)}>{t.title}</button>
          <div className="tbuckets">
            {buckets.map(b => (
              <button key={b.id} className="bchip sm" onClick={() => onAssign(t.id, b.id)}>
                <i style={{ background: bucketColor(b) }} />{b.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
