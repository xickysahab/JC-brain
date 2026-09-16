import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './shared/styles/tokens.css';
import './shared/styles/base.css';

/* The service worker is what lets the app open without a connection and what
   draws a reminder while the tab is closed. Registered on boot rather than on
   first use, so the cache is already warm the first time the train goes into
   a tunnel. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </StrictMode>
);
