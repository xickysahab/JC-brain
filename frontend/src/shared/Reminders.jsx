import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { api } from './api.js';

/* The switch that makes the attention engine audible.

   Everything here is a no-op in a browser that cannot do push, or on a server
   with no keys configured, so the control simply is not drawn rather than
   offering something that will not work. */

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const toBytes = base64 => {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
};

export default function Reminders() {
  const [state, setState] = useState('checking');   // checking | off | on | unavailable | denied
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!supported()) return setState('unavailable');
    try {
      const { enabled } = await api.get('/push/key');
      if (!enabled) return setState('unavailable');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'on' : 'off');
    } catch { setState('unavailable'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const { key } = await api.get('/push/key');
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      // Ask only when the user has just asked for it - an unprompted
      // permission dialog is the fastest way to get permanently blocked.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'off'); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toBytes(key)
      });
      await api.post('/push/subscribe', sub.toJSON());
      setState('on');
      await api.post('/push/test');
    } catch (e) {
      console.error('reminders', e);
      setState('off');
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.del('/push/subscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
    } finally { setBusy(false); }
  };

  if (state === 'checking' || state === 'unavailable') return null;

  if (state === 'denied') return (
    <button className="btn sm" disabled title="Notifications are blocked for this site in your browser settings">
      <BellOff size={15} /> Blocked
    </button>
  );

  return state === 'on' ? (
    <button className="btn sm remind on" onClick={disable} disabled={busy} title="Turn reminders off">
      <BellRing size={15} /> Reminders on
    </button>
  ) : (
    <button className="btn sm remind" onClick={enable} disabled={busy} title="Get told when a task is due, even with the tab closed">
      <Bell size={15} /> {busy ? 'Enabling…' : 'Reminders'}
    </button>
  );
}
