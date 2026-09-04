/* Origin allowlist for CORS. Lives in its own file so it can be tested without
   starting the server - this logic shipped broken once and cost a production
   debug session. */

export const parseOrigins = raw =>
  (raw || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);

/** True means "send CORS headers". A request with no Origin is not a browser
    cross-origin call at all, so it always passes. An unlisted origin returns
    false, which omits the headers and leaves the decision to the browser - it
    must never turn into a server-side rejection. */
export const isAllowed = (origin, list) =>
  !origin || list.includes(origin.replace(/\/$/, ''));
