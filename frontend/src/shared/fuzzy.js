/* Ranking for the command palette.

   Typing "srp" means Send Revised Proposal, not the s-r-p that happen to
   appear inside "Instagram reel plan". Letters landing on word starts are
   what the user was aiming at, so they weigh far more than letters landing
   anywhere at all. */

const isBoundary = (s, i) => i === 0 || /[\s\-_/]/.test(s[i - 1]);

/** Higher is better. Negative means no match at all. */
export function score(needle, hay) {
  const n = String(needle || '').trim().toLowerCase();
  const h = String(hay || '').toLowerCase();
  if (!n) return 0;

  const at = h.indexOf(n);
  if (at === 0) return 1000;                       // starts with what you typed
  if (at > 0) return 800 - at + (isBoundary(h, at) ? 100 : 0);

  // Subsequence, counting how many letters landed on a word start.
  let i = 0, starts = 0;
  for (let k = 0; k < h.length && i < n.length; k++) {
    if (h[k] !== n[i]) continue;
    if (isBoundary(h, k)) starts++;
    i++;
  }
  if (i < n.length) return -1;
  // All-initials ("srp" -> Send Revised Proposal) outranks a scattered match,
  // and length only breaks ties.
  return 200 + starts * 120 - h.length * 0.1;
}

/** Sorts candidates by how well `label` matches, dropping non-matches. */
export const rank = (needle, items, label = x => x.label, limit = 9) =>
  items.map(it => ({ it, s: score(needle, label(it)) }))
       .filter(x => x.s >= 0)
       .sort((a, b) => b.s - a.s)
       .slice(0, limit)
       .map(x => x.it);
