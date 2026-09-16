import { useEffect, useState } from 'react';

/* A key event dispatched on window has no .matches; guard before asking. */
const isField = el => el instanceof Element && el.matches('input, textarea, select, [contenteditable]');

/* Keyboard control of the task list.

   A morning's triage is the same four decisions repeated twenty times. With a
   mouse that is twenty trips across the screen; with these it is twenty
   keystrokes without leaving the home row. */
export function useListKeys({ tasks, buckets, enabled, onOpen, onToggleDone, onAssign, onSelect }) {
  const [focus, setFocus] = useState(-1);

  // Keep the cursor pointing at something after the list changes under it.
  useEffect(() => {
    setFocus(f => (f >= tasks.length ? tasks.length - 1 : f));
  }, [tasks.length]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = e => {
      // Never steal a key someone is typing into a field or a dialog.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isField(e.target)) return;
      if (document.querySelector('.tmodal, .cmdk, .drawer')) return;

      const move = d => {
        e.preventDefault();
        setFocus(f => Math.max(0, Math.min(tasks.length - 1, (f < 0 ? -1 : f) + d)));
      };
      if (e.key === 'j' || e.key === 'ArrowDown') return move(1);
      if (e.key === 'k' || e.key === 'ArrowUp') return move(-1);

      if (e.key === '/') { e.preventDefault(); document.querySelector('input[type=search]')?.focus(); return; }
      if (e.key === 'c') { e.preventDefault(); document.querySelector('.capture textarea')?.focus(); return; }
      if (e.key === 'Escape') return setFocus(-1);

      const task = tasks[focus];
      if (!task) return;

      if (e.key === 'Enter' || e.key === 'e') { e.preventDefault(); return onOpen(task); }
      if (e.key === 'd') { e.preventDefault(); return onToggleDone(task); }
      if (e.key === 'x') { e.preventDefault(); return onSelect(task.id); }

      // 1-9 file into the bucket in that position; 0 empties the bucket.
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const n = Number(e.key);
        if (n === 0) return onAssign(task.id, null);
        const b = buckets[n - 1];
        if (b) onAssign(task.id, b.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, tasks, buckets, focus, onOpen, onToggleDone, onAssign, onSelect]);

  // Keep the focused row on screen when the cursor runs past the fold.
  useEffect(() => {
    if (focus < 0) return;
    document.querySelectorAll('.row')[focus]?.scrollIntoView({ block: 'nearest' });
  }, [focus]);

  return [focus, setFocus];
}
