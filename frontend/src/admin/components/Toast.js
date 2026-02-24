import React from 'react';

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

function Toast({ toasts, onRemove }) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`admin-toast ${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          <span className="text-lg">{icons[toast.type] || icons.info}</span>
          <span className="flex-1">{toast.message}</span>
          <button className="opacity-50 hover:opacity-100">×</button>
        </div>
      ))}
    </div>
  );
}

export default Toast;
