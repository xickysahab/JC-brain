import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

export default function Pomodoro({ widget }) {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggle = () => setIsActive(!isActive);
  const reset = () => { setIsActive(false); setTimeLeft(25 * 60); };

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  return (
    <div className="w-pomodoro">
      <div className="w-pomo-time">{mins}:{secs}</div>
      <div className="w-pomo-controls">
        <button className={`w-pomo-btn ${isActive ? '' : 'primary'}`} onClick={toggle}>
          {isActive ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 3 }} />}
        </button>
        <button className="w-pomo-btn" onClick={reset}>
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
