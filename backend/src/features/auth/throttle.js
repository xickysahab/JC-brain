/* Failed-login throttle.

   In memory, per process. One Render instance is the whole deployment today,
   and a shared store is a dependency this does not need yet.
   ponytail: move to Redis (or a table) when the API runs on more than one box -
   until then a second instance simply doubles the allowance. */

export function createThrottle({ limit, windowMs = 15 * 60 * 1000 } = {}) {
  const hits = new Map();

  return {
    blocked(key, now = Date.now()) {
      const v = hits.get(key);
      return !!v && v.count >= limit && now - v.first <= windowMs;
    },
    fail(key, now = Date.now()) {
      // Sweep on write: without this the map is an unbounded record of every
      // address that ever mistyped a password.
      for (const [k, v] of hits) if (now - v.first > windowMs) hits.delete(k);

      const v = hits.get(key);
      if (!v || now - v.first > windowMs) hits.set(key, { first: now, count: 1 });
      else v.count++;
    },
    clear(key) { hits.delete(key); },
    get size() { return hits.size; }
  };
}

/* Two limits, because one address is not one person. The per-address limit
   stops a script working through a list of emails; the per-email limit stops
   it working through a list of passwords for one account. */
export const byAddress = createThrottle({ limit: 40 });
export const byAccount = createThrottle({ limit: 8 });
