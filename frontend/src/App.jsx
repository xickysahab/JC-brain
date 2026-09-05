import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './shared/api.js';
import Shell from './shared/Shell.jsx';
import Login from './pages/Login/Login.jsx';
import Tasks from './pages/Tasks/Tasks.jsx';
import Users from './pages/Users/Users.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import Calendar from './pages/Calendar/Calendar.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // One call on boot decides whether the cookie is still good.
  useEffect(() => {
    api.get('/auth/me').then(d => setUser(d.user)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  if (!user) return <Login onSignedIn={setUser} />;

  return (
    <Shell user={user} onSignedOut={() => setUser(null)}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/todo" element={<Tasks />} />
        <Route path="/calendar" element={<Calendar />} />
        {user.role === 'admin' && <Route path="/admin" element={<Users me={user} />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
