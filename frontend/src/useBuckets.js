import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** The user's buckets plus how many loose tasks are still waiting to be sorted. */
export function useBuckets() {
  const [buckets, setBuckets] = useState([]);
  const [unbucketed, setUnbucketed] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.get('/buckets');
      setBuckets(d.buckets); setUnbucketed(d.unbucketed);
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const wrap = fn => async (...args) => {
    setError('');
    try { await fn(...args); await load(); return true; }
    catch (e) { setError(e.message); return false; }
  };

  return {
    buckets, unbucketed, error, reload: load, clearError: () => setError(''),
    create: wrap(name => api.post('/buckets', { name })),
    rename: wrap((id, name) => api.patch(`/buckets/${id}`, { name })),
    remove: wrap(id => api.del(`/buckets/${id}`))
  };
}

export const bucketColor = b => `var(--series-${((b?.color ?? 0) % 8) + 1})`;
