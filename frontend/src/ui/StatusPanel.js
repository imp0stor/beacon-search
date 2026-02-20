import React from 'react';

export default function StatusPanel({ title, subtitle, children }) {
  return (
    <div className="ui-card panel status-panel ss-status-panel">
      {title ? <h3>{title}</h3> : null}
      {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
      <div className="status-panel-body">{children}</div>
    </div>
  );
}
