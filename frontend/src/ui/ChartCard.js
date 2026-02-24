import React from 'react';

export default function ChartCard({ title, subtitle, children }) {
  return (
    <div className="ui-card panel ss-chart-card">
      {title ? <h3>{title}</h3> : null}
      {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
      <div className="chart-card-body">{children}</div>
    </div>
  );
}
