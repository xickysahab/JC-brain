import { useEffect, useState } from 'react';

/* Which palette the app is wearing.

   Three choices, not two: Auto follows the operating system, which is what
   most people want and is the only one that changes by itself at sunset.
   Light and Dark are a decision the person made, and a decision outlives the
   OS changing its mind.

   The resolved answer is stamped on <html> as data-theme, and the boot script
   in index.html stamps it before the first paint - React mounting is far too
   late to decide what colour the page is. */

export const CHOICES = ['auto', 'light', 'dark'];
const KEY = 'jc.theme';

const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;

export const readChoice = () => {
  try {
    const saved = localStorage.getItem(KEY);
    return CHOICES.includes(saved) ? saved : 'auto';
  } catch { return 'auto'; }        // private window, or storage switched off
};

export const resolve = choice => (choice === 'auto' ? (systemDark() ? 'dark' : 'light') : choice);

function stamp(choice) {
  const root = document.documentElement;
  root.dataset.theme = resolve(choice);

  /* The eased cross-fade is switched on only for the length of the change.
     Leaving it on would put a fifth of a second of lag behind every hover in
     the app. */
  root.classList.add('theme-turning');
  clearTimeout(stamp.timer);
  stamp.timer = setTimeout(() => root.classList.remove('theme-turning'), 260);
}

/** @returns {[string, (next: string) => void]} the choice, and how to change it */
export function useTheme() {
  const [choice, setChoice] = useState(readChoice);

  // Auto means auto: if the OS flips at sunset, so does the app.
  useEffect(() => {
    if (choice !== 'auto') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onFlip = () => stamp('auto');
    mq.addEventListener('change', onFlip);
    return () => mq.removeEventListener('change', onFlip);
  }, [choice]);

  const set = next => {
    if (!CHOICES.includes(next)) return;
    setChoice(next);
    stamp(next);
    try { localStorage.setItem(KEY, next); } catch { /* nothing to remember it with */ }
  };

  return [choice, set];
}
