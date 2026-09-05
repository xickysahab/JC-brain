import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api.js';

/** The task modal's shape: the catalogue to pick from, and this user's pick. */
export function useTaskFields() {
  const [fields, setFields] = useState([]);
  const [visible, setVisible] = useState([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get('/preferences/task-fields');
      setFields(d.fields); setVisible(d.visible);
    } catch { /* the modal still works with title only */ }
    finally { setReady(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async next => {
    const d = await api.put('/preferences/task-fields', { visible: next });
    setVisible(d.visible);
    return d.visible;
  };

  return { fields, visible, ready, save };
}
