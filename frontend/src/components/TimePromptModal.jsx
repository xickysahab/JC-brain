import { useState, useEffect } from 'react';
import DialogModal from './DialogModal.jsx';

const HOURS = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const MINS = ['00', '15', '30', '45'];

function TimeSelect({ label, time, setTime }) {
  return (
    <div className="tprompt-block">
      <label>{label}</label>
      <div className="tprompt-inputs">
        <select value={time.h} onChange={e => setTime({ ...time, h: e.target.value })}>
          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span>:</span>
        <select value={time.m} onChange={e => setTime({ ...time, m: e.target.value })}>
          {MINS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={time.ampm} onChange={e => setTime({ ...time, ampm: e.target.value })}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

export default function TimePromptModal({ day, defaultHour, defaultMin, onClose, onConfirm }) {
  const dHour = defaultHour ?? 10;
  let dMin = defaultMin ?? 0;
  dMin = Math.round(dMin / 15) * 15 % 60;
  const isPM = dHour >= 12;
  const h12 = dHour % 12 || 12;
  
  const [start, setStart] = useState({
    h: String(h12).padStart(2, '0'),
    m: String(dMin).padStart(2, '0'),
    ampm: isPM ? 'PM' : 'AM'
  });

  // Default end is 1 hour after start
  const endHour = dHour + 1;
  const eIsPM = (endHour % 24) >= 12 && (endHour % 24) < 24;
  const eH12 = endHour % 12 || 12;
  const [end, setEnd] = useState({
    h: String(eH12).padStart(2, '0'),
    m: String(dMin).padStart(2, '0'),
    ampm: eIsPM ? 'PM' : 'AM'
  });

  const handleSubmit = e => {
    e.preventDefault();
    
    let sH = parseInt(start.h, 10);
    if (start.ampm === 'PM' && sH < 12) sH += 12;
    if (start.ampm === 'AM' && sH === 12) sH = 0;
    
    let eH = parseInt(end.h, 10);
    if (end.ampm === 'PM' && eH < 12) eH += 12;
    if (end.ampm === 'AM' && eH === 12) eH = 0;

    const sDate = new Date(day);
    sDate.setHours(sH, parseInt(start.m, 10), 0, 0);

    const eDate = new Date(day);
    eDate.setHours(eH, parseInt(end.m, 10), 0, 0);
    
    // If end is before start, assume it goes to next day (or just error out)
    if (eDate <= sDate) {
      eDate.setDate(eDate.getDate() + 1);
    }

    onConfirm(sDate, eDate);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} style={{ zIndex: 999 }} />
      <form className="tprompt-modal" onSubmit={handleSubmit}>
        <div className="tprompt-head">
          <h3>Time Block</h3>
          <p>Allocate time for {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        </div>
        
        <div className="tprompt-body">
          <TimeSelect label="STARTS AT" time={start} setTime={setStart} />
          <div className="tprompt-div" />
          <TimeSelect label="ENDS AT" time={end} setTime={setEnd} />
        </div>

        <div className="tprompt-foot">
          <button type="button" className="btn ghostbtn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Schedule</button>
        </div>
      </form>
    </>
  );
}
