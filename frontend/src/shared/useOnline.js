import { useEffect, useState } from 'react';

/** Whether the browser currently has a connection. Starts from the browser's
    own answer, so a page opened offline says so on the first frame. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine !== false);

  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  return online;
}
