import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function DialogModal({ dialog, onClose }) {
  const [val, setVal] = useState(dialog?.defaultValue || '');

  useEffect(() => {
    if (dialog) setVal(dialog.defaultValue || '');
  }, [dialog]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!dialog) return null;

  const submit = (e) => {
    if (e) e.preventDefault();
    if (dialog.type === 'prompt' && !val.trim()) return;
    dialog.onConfirm(dialog.type === 'prompt' ? val : true);
  };

  return (
    <>
      <div className="scrim" onClick={onClose} style={{ zIndex: 100 }} />
      <div className="tmodal dialog-modal" style={{ width: 'min(420px, 94vw)', top: '40%', zIndex: 101 }}>
        <header style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{dialog.title}</h2>
          <button type="button" className="dclose" onClick={onClose}><X size={18} /></button>
        </header>

        <form onSubmit={submit} style={{ padding: '16px 22px' }}>
          {dialog.description && (
            <p style={{ color: 'var(--ink-3)', fontSize: '13.5px', marginTop: 0, marginBottom: '16px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {dialog.description}
            </p>
          )}

          {dialog.type === 'prompt' && (
            <input 
              autoFocus 
              value={val} 
              onChange={e => setVal(e.target.value)} 
              placeholder={dialog.placeholder || ''}
              style={{ width: '100%', height: '42px', padding: '0 12px', fontSize: '14.5px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink)', boxSizing: 'border-box' }}
            />
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={onClose}>
              {dialog.cancelLabel || 'Cancel'}
            </button>
            <button type="submit" className={`btn ${dialog.danger ? 'danger' : 'primary'}`}>
              {dialog.confirmLabel || 'OK'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
