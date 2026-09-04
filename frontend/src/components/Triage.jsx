import { bucketColor } from '../useBuckets.js';

/* The second half of "dump now, sort later": every loose task with the bucket
   chips right underneath it, so sorting twenty tasks is twenty clicks and no
   dialogs. */
export default function Triage({ tasks, buckets, onAssign, onOpen, busyId }) {
  if (!buckets.length) {
    return (
      <div className="empty">
        <strong>Pehle ek bucket banao</strong>
        Upar &ldquo;+ New bucket&rdquo; se — Payment, Sales, Content, jo bhi aapka kaam hai.
      </div>
    );
  }
  if (!tasks.length) {
    return (
      <div className="empty">
        <strong>Sab kuch sort ho chuka hai</strong>
        Koi task bina bucket ke nahi bacha.
      </div>
    );
  }

  return (
    <>
      <p className="muted" style={{ margin: '0 0 10px' }}>
        {tasks.length} task bina bucket ke. Neeche se bucket chuno — turant chala jaayega.
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
