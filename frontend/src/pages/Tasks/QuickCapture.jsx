import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, CornerDownLeft } from 'lucide-react';
import { parseTask } from '../../shared/parseTask.js';
import { api } from '../../shared/api.js';

const CHIP_ORDER = { time: 0, date: 0, bucket: 1, priority: 2, owner: 3 };

/* The whole capture surface.

   Enter saves what was typed, parsed. ⌘Enter opens the full form instead, for
   the times someone genuinely wants all seventeen fields. Pasting several
   lines makes several tasks, so twenty dumped thoughts cost one paste.

   The chips under the input are not decoration: they are how the guess gets
   checked before it is committed. */
export default function QuickCapture({ buckets, defaultBucketId, onCreate, onOpenForm, busy }) {
  const [text, setText] = useState('');
  const [hint, setHint] = useState(null);       // a bucket this title has gone to before
  const [accepted, setAccepted] = useState(null);
  const inputRef = useRef(null);

  // chrono is not free; only re-parse when the line actually changes.
  const parsed = useMemo(() => parseTask(text, { buckets }), [text, buckets]);
  const chips = [...parsed.chips].sort((a, b) => CHIP_ORDER[a.kind] - CHIP_ORDER[b.kind]);

  /* Ask where this has been filed before, once the typing pauses. Debounced
     rather than per keystroke, and skipped entirely when a #bucket was typed -
     an explicit choice is never second-guessed. */
  useEffect(() => {
    if (parsed.bucket_id || parsed.title.trim().length < 3) { setHint(null); return; }
    const id = setTimeout(() => {
      api.get(`/buckets/suggest?title=${encodeURIComponent(parsed.title)}`)
        .then(d => setHint(d.suggestion))
        .catch(() => setHint(null));
    }, 300);
    return () => clearTimeout(id);
  }, [parsed.title, parsed.bucket_id]);

  const draft = () => ({
    title: parsed.title,
    status: 'Todo',
    deadline: parsed.deadline,
    start_date: parsed.start_date,
    priority: parsed.priority,
    owner: parsed.owner,
    bucket_id: parsed.bucket_id || accepted || (defaultBucketId !== 'none' ? defaultBucketId : null) || null
  });

  const submit = async e => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const drafts = lines.length > 1
      ? lines.map(line => {
          const one = parseTask(line, { buckets });
          return { title: one.title, status: 'Todo', deadline: one.deadline, start_date: one.start_date,
                   priority: one.priority, owner: one.owner,
                   bucket_id: one.bucket_id || (defaultBucketId !== 'none' ? defaultBucketId : null) || null };
        })
      : [draft()];
    setText('');
    setHint(null);
    setAccepted(null);
    await onCreate(drafts);
    inputRef.current?.focus();
  };

  const onKeyDown = e => {
    // Tab takes the suggestion. One key, and only when there is one to take.
    if (e.key === 'Tab' && hint && !accepted) {
      e.preventDefault();
      setAccepted(hint.id);
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) {            // the escape hatch into the full form
      if (!text.trim()) return;
      onOpenForm(draft());
      setText('');
      return;
    }
    submit();
  };

  /* A multi-line paste is a dump, not a title. Turning it into one task with
     newlines in the name is never what the person meant. */
  const onPaste = e => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.includes('\n')) return;
    e.preventDefault();
    setText(t => (t ? t + '\n' : '') + pasted.trim());
  };

  const lineCount = text.split('\n').filter(l => l.trim()).length;

  const suggestionChip = hint && (
    accepted === hint.id
      ? <span className="crchip bucket">{hint.name}</span>
      : <button type="button" className="crchip guess" onClick={() => setAccepted(hint.id)}>
          {hint.name} <kbd>tab</kbd>
        </button>
  );

  return (
    <div className="capture">
      <form className="quick" onSubmit={submit}>
        <textarea
          ref={inputRef}
          rows={text.includes('\n') ? Math.min(8, lineCount + 1) : 1}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="What needs doing?  try: proposal to Zenith tomorrow 3pm #sales !sos"
          aria-label="Capture a task"
          disabled={busy}
        />
        <button className="btn primary" disabled={!text.trim() || busy}>
          <Plus size={16} />{lineCount > 1 ? `Add ${lineCount}` : 'Add'}
        </button>
      </form>

      {text.trim() && (
        <div className="capture-read">
          {chips.length > 0 ? (
            <>
              <span className="cr-title">{parsed.title}</span>
              {chips.map((c, i) => <span key={i} className={'crchip ' + c.kind}>{c.label}</span>)}
              {suggestionChip}
            </>
          ) : (
            <>
              {suggestionChip}
              <span className="cr-hint">
                Add <code>tomorrow 3pm</code>, <code>#bucket</code>, <code>!sos</code> or <code>@name</code> to fill more in one line
              </span>
            </>
          )}
          <span className="grow" />
          <span className="cr-keys">
            <kbd><CornerDownLeft size={11} /></kbd> save
            <kbd>⌘<CornerDownLeft size={11} /></kbd> full form
          </span>
        </div>
      )}
    </div>
  );
}
