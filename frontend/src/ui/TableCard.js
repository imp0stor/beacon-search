import React from 'react';

export default function TableCard({ title, subtitle, children, actions }) {
  return (
    <div className="ui-card panel ss-table-card">
      {title ? <h3>{title}</h3> : null}
      {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
      <div className="table-card-body">{children}</div>
      {actions ? <div className="table-card-actions">{actions}</div> : null}
    </div>
  );
}
