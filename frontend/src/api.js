/* Where the API lives.
   - Dev: empty, so calls go to /api and Vite proxies them to localhost:4000.
   - Vercel with the /api rewrite in vercel.json: also empty. Same-origin means
     the session cookie stays first-party, which is the least fragile setup.
   - Calling Render directly instead: set VITE_API_URL to the Render URL and add
     that Vercel domain to CORS_ORIGINS on the backend. */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function call(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get:   p      => call('GET', p),
  post:  (p, b) => call('POST', p, b),
  patch: (p, b) => call('PATCH', p, b),
  del:   p      => call('DELETE', p)
};
