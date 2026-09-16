/* Buckets that file themselves.

   Nine invoices went to Payments; the tenth should arrive already filed. This
   is counting, not a model: which words have gone to which bucket before, and
   how strongly. The user's own history is the whole training set, so it is
   right about their vocabulary from the first week and never about anyone
   else's. */

// Words that carry no filing signal. Short ones are dropped by length.
const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'about', 'call',
  'send', 'make', 'need', 'have', 'get', 'new', 'task', 'todo', 'day', 'week'
]);

export function tokenize(text) {
  return [...new Set(
    String(text || '').toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(w => w.length >= 3 && !STOP.has(w))
  )];
}

/** @param {Array<{title:string, bucket_id:string}>} tasks */
export function buildModel(tasks) {
  const terms = {};
  for (const t of tasks) {
    if (!t.bucket_id) continue;
    for (const w of tokenize(t.title)) {
      (terms[w] ||= {})[t.bucket_id] = (terms[w][t.bucket_id] || 0) + 1;
    }
  }
  return terms;
}

/* A word that has only ever gone to one bucket is worth more than a word
   spread across several - the spread one says nothing about where this goes.

   The -0.5 is what keeps a single sighting from becoming a suggestion: seen
   once a word contributes half a point, so two such words still fall under the
   threshold. Habits earn their confidence; coincidences do not. */
function weigh(counts) {
  const entries = Object.entries(counts);
  const total = entries.reduce((n, [, c]) => n + c, 0);
  return entries.map(([bucketId, c]) => [bucketId, (c / total) * Math.min(c - 0.5, 5)]);
}

/**
 * @returns {{bucket_id: string, score: number}|null} null when nothing is
 * confident enough - a wrong guess costs more than no guess.
 */
export function suggest(title, terms, { min = 1.2, lead = 1.5 } = {}) {
  const scores = {};
  for (const w of tokenize(title)) {
    if (!terms[w]) continue;
    for (const [bucketId, weight] of weigh(terms[w])) {
      scores[bucketId] = (scores[bucketId] || 0) + weight;
    }
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [top, second] = ranked;
  if (top[1] < min) return null;
  if (second && top[1] < second[1] * lead) return null;   // too close to call
  return { bucket_id: top[0], score: Number(top[1].toFixed(2)) };
}
