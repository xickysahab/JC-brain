import { useEffect, useState } from 'react';

export default function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-clock">
      <strong>{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</strong>
      <span>{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
    </div>
  );
}
