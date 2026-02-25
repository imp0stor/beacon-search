import React from 'react';

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value.toFixed(unitIdx === 0 ? 0 : 1)} ${units[unitIdx]}`;
};

export default function IndexStatusWidget({ indexStatus, loading }) {
  return (
    <section className="admin-widget">
      <div className="admin-widget__header">
        <h3>Index Status</h3>
      </div>

      {loading ? (
        <div className="admin-widget__loading">Loading index status…</div>
      ) : (
        <>
          <div className="admin-index-summary">
            <div>
              <div className="admin-kpi-card__label">Total Documents</div>
              <div className="admin-kpi-card__value">{indexStatus?.totalDocuments ?? 0}</div>
            </div>
            <div>
              <div className="admin-kpi-card__label">Estimated Index Size</div>
              <div className="admin-kpi-card__value admin-kpi-card__value--small">{formatBytes(indexStatus?.estimatedSizeBytes)}</div>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {(indexStatus?.byType || []).slice(0, 8).map((row) => (
                  <tr key={row.type}>
                    <td>{row.type}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
