import { useCallback, useRef, useState } from 'react';

/* Undo/redo for the canvas.
   A drag fires dozens of updates a second, so history is not pushed per update.
   begin() snapshots once when a gesture starts, set() then moves the widget
   freely, and the whole drag ends up as a single undo step. */
export function useHistory(initial) {
  const [state, setState] = useState({ past: [], present: initial, future: [] });
  const gesturing = useRef(false);

  const begin = useCallback(() => {
    if (gesturing.current) return;
    gesturing.current = true;
    setState(s => ({ past: [...s.past, s.present].slice(-50), present: s.present, future: [] }));
  }, []);

  const end = useCallback(() => { gesturing.current = false; }, []);

  /** Change the layout. Outside a gesture this is its own undo step.

      inGesture is read here, at call time, and NOT inside the updater. React
      runs updaters when it renders, which can be after pointerup has already
      cleared the ref - and then every move in a batched drag pushed its own
      undo step, so one drag took several undos to reverse. */
  const set = useCallback(next => {
    const inGesture = gesturing.current;
    setState(s => {
      const value = typeof next === 'function' ? next(s.present) : next;
      if (inGesture) return { ...s, present: value };
      return { past: [...s.past, s.present].slice(-50), present: value, future: [] };
    });
  }, []);

  const undo = useCallback(() => setState(s => s.past.length
    ? { past: s.past.slice(0, -1), present: s.past.at(-1), future: [s.present, ...s.future] }
    : s), []);

  const redo = useCallback(() => setState(s => s.future.length
    ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
    : s), []);

  /** Replace everything and forget the history - used after load, save or reset. */
  const reset = useCallback(present => setState({ past: [], present, future: [] }), []);

  return {
    widgets: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    begin, end, set, undo, redo, reset
  };
}
