import React from 'react';

export default function KpiCard({ value, label, sublabel }) {
  return (
    <div className="ui-kpi analytics-card ss-kpi-card">
      <div className="analytics-value">{value}</div>
      <div className="analytics-label">{label}</div>
      {sublabel ? <div className="analytics-sublabel">{sublabel}</div> : null}
    </div>
  );
}
