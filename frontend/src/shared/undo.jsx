import { useEffect, useState } from 'react';
import { Undo2, X } from 'lucide-react';

/* Undo instead of confirm.

   A confirmation charges every user a click to protect against a mistake most
   of them will never make. Undo charges only the person who actually made it.

   The change is applied to the screen immediately and the server call is held
   for a few seconds. Undo cancels the call outright, so nothing was ever
   deleted - this is a real undo, not a re-create with a new id. */

const WINDOW_MS = 6000;
let pending = null;
let listeners = new Set();
const emit = () => listeners.forEach(fn => fn(pending));

/** Commit whatever is waiting, right now. Called before a second undoable
    starts and when the page is closing, so a held action is never lost. */
export function flushUndo() {
  if (!pending) return;
  const { commit, timer } = pending;
  clearTimeout(timer);
  pending = null;
  emit();
  commit();
}

/**
 * @param {object}   o
 * @param {string}   o.message  what just happened, in the past tense
 * @param {Function} o.commit   the real server call, held for a few seconds
 * @param {Function} o.revert   put the screen back the way it was
 * @param {string=}  o.hideId   a row id to hide from lists while the call is held
 */
export function undoable({ message, commit, revert, hideId }) {
  flushUndo();
  const timer = setTimeout(flushUndo, WINDOW_MS);
  pending = {
    message, commit, timer, hideId,
    undo() {
      clearTimeout(timer);
      pending = null;
      emit();
      revert();
    }
  };
  emit();
}

/* Lists ask this which rows are mid-delete. Without it a deleted row would
   reappear on the next refetch, because the server still has it until the
   undo window closes. */
export function usePendingHidden() {
  const [state, setState] = useState(pending);
  useEffect(() => { listeners.add(setState); return () => listeners.delete(setState); }, []);
  return state?.hideId ? new Set([state.hideId]) : EMPTY;
}
const EMPTY = new Set();

export function Toaster() {
  const [state, setState] = useState(pending);

  useEffect(() => {
    listeners.add(setState);
    // A held action must still happen if the tab is closed mid-window.
    const flush = () => flushUndo();
    window.addEventListener('beforeunload', flush);
    return () => { listeners.delete(setState); window.removeEventListener('beforeunload', flush); };
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (!pending) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (e.target.matches('input, textarea, [contenteditable]')) return;
        e.preventDefault();
        pending.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!state) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      <span>{state.message}</span>
      <button onClick={() => state.undo()}><Undo2 size={13} /> Undo <kbd>⌘Z</kbd></button>
      <button className="x" onClick={flushUndo} aria-label="Dismiss"><X size={13} /></button>
    </div>
  );
}
