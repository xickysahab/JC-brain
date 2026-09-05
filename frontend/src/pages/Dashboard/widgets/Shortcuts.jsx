import { Calendar, CheckSquare, Settings, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Shortcuts({ widget }) {
  // Use config to dynamically render shortcuts if needed later
  return (
    <div className="w-shortcuts">
      <Link to="/todo" className="w-shortcut-btn" style={{ textDecoration: 'none' }}>
        <div className="w-shortcut-icon"><CheckSquare size={20} /></div>
        <span className="w-shortcut-label">Tasks</span>
      </Link>
      <Link to="/calendar" className="w-shortcut-btn" style={{ textDecoration: 'none' }}>
        <div className="w-shortcut-icon" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}><Calendar size={20} /></div>
        <span className="w-shortcut-label">Calendar</span>
      </Link>
      <Link to="/admin" className="w-shortcut-btn" style={{ textDecoration: 'none' }}>
        <div className="w-shortcut-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}><User size={20} /></div>
        <span className="w-shortcut-label">Admin</span>
      </Link>
      <button className="w-shortcut-btn">
        <div className="w-shortcut-icon" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}><Settings size={20} /></div>
        <span className="w-shortcut-label">Settings</span>
      </button>
    </div>
  );
}
