import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api.js';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Todo from './pages/Todo.jsx';
import Admin from './pages/Admin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Calendar from './pages/Calendar.jsx';

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
        <Route path="/todo" element={<Todo />} />
        <Route path="/calendar" element={<Calendar />} />
        {user.role === 'admin' && <Route path="/admin" element={<Admin me={user} />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
