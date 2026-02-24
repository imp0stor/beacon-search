/**
 * AnalyticsDashboard.jsx
 * 
 * Author/Creator analytics dashboard with zap earnings, engagement metrics, and heatmaps
 * 
 * Created: 2026-02-20 (P2 Features)
 */

import React, { useState, useEffect } from 'react';
import './AnalyticsDashboard.css';
import DocumentHeatmap from './DocumentHeatmap';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function AnalyticsDashboard({ authorPubkey, closeModal }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  useEffect(() => {
    if (!authorPubkey) return;

    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/api/authors/${authorPubkey}/analytics`
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [authorPubkey]);

  const handleViewHeatmap = (documentId) => {
    setSelectedDocument(documentId);
    setActiveTab('heatmaps');
  };

  const renderTrendIcon = (direction) => {
    switch (direction) {
      case 'up':
        return <span className="trend-up">📈</span>;
      case 'down':
        return <span className="trend-down">📉</span>;
      default:
        return <span className="trend-flat">➡️</span>;
    }
  };

  const formatSats = (amount) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
    return amount.toString();
  };

  if (loading) {
    return (
      <div className="analytics-modal">
        <div className="modal-header">
          <h2>Author Analytics</h2>
          <button className="close-btn" onClick={closeModal}>✕</button>
        </div>
        <div className="loading">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-modal">
        <div className="modal-header">
          <h2>Author Analytics</h2>
          <button className="close-btn" onClick={closeModal}>✕</button>
        </div>
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-modal">
        <div className="modal-header">
          <h2>Author Analytics</h2>
          <button className="close-btn" onClick={closeModal}>✕</button>
        </div>
        <div className="empty-state">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="analytics-modal">
      <div className="modal-header">
        <div className="header-content">
          <h2>Author Analytics Dashboard</h2>
          {analytics.author.name && (
            <p className="author-name">{analytics.author.name}</p>
          )}
        </div>
        <button className="close-btn" onClick={closeModal}>✕</button>
      </div>

      <div className="analytics-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          Content Performance
        </button>
        <button
          className={`tab-btn ${activeTab === 'heatmaps' ? 'active' : ''}`}
          onClick={() => setActiveTab('heatmaps')}
        >
          Zap Heatmaps
        </button>
        <button
          className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Recent Activity
        </button>
      </div>

      <div className="analytics-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="metrics-grid">
              <MetricCard
                label="Total Earned"
                value={`${formatSats(analytics.stats.totalZapsEarned)} sats`}
                icon="⚡"
              />
              <MetricCard
                label="Documents"
                value={analytics.stats.totalDocuments.toString()}
                icon="📄"
              />
              <MetricCard
                label="Avg per Document"
                value={`${formatSats(analytics.stats.averageZapPerDocument)} sats`}
                icon="📊"
              />
              <MetricCard
                label="Last Week"
                value={`${formatSats(analytics.trends.lastWeekZaps)} sats`}
                trend={analytics.trends.trendDirection}
                trendPercent={analytics.trends.trendPercent}
                icon={renderTrendIcon(analytics.trends.trendDirection)}
              />
            </div>

            {analytics.contentBreakdown.length > 0 && (
              <div className="content-breakdown">
                <h3>Content Breakdown by Type</h3>
                <div className="breakdown-grid">
                  {analytics.contentBreakdown.map((item) => (
                    <div key={item.type} className="breakdown-item">
                      <div className="breakdown-type">{item.type}</div>
                      <div className="breakdown-count">{item.count} items</div>
                      <div className="breakdown-earned">
                        {formatSats(item.zapsEarned)} sats
                      </div>
                      <div className="breakdown-avg">
                        {formatSats(item.averagePerItem)} avg
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Performance Tab */}
        {activeTab === 'performance' && (
          <div className="tab-content">
            {analytics.contentBreakdown.length > 0 ? (
              <div className="performance-table">
                <h3>Content Performance</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Count</th>
                      <th>Total Sats</th>
                      <th>Avg per Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.contentBreakdown.map((item) => (
                      <tr key={item.type}>
                        <td>{item.type}</td>
                        <td>{item.count}</td>
                        <td>⚡ {formatSats(item.zapsEarned)}</td>
                        <td>{formatSats(item.averagePerItem)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No content performance data yet</div>
            )}
          </div>
        )}

        {/* Heatmaps Tab */}
        {activeTab === 'heatmaps' && (
          <div className="tab-content">
            {selectedDocument ? (
              <div>
                <button className="back-btn" onClick={() => setSelectedDocument(null)}>
                  ← Back to documents
                </button>
                <DocumentHeatmap documentId={selectedDocument} />
              </div>
            ) : (
              <div className="heatmap-list">
                <h3>Select a document to view zap heatmap</h3>
                <p className="hint">
                  Heatmaps show which sections received the most zaps
                </p>
                {analytics.contentBreakdown.length > 0 ? (
                  <p className="info">
                    Load your top documents to see detailed heatmaps
                  </p>
                ) : (
                  <div className="empty-state">No documents yet</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recent Activity Tab */}
        {activeTab === 'activity' && (
          <div className="tab-content">
            {analytics.recentActivity && analytics.recentActivity.length > 0 ? (
              <div className="activity-list">
                <h3>Recent Activity</h3>
                {analytics.recentActivity.map((activity, idx) => (
                  <div key={idx} className="activity-item">
                    <div className="activity-icon">
                      {activity.action === 'zap' ? '⚡' : '👁️'}
                    </div>
                    <div className="activity-content">
                      <div className="activity-action">
                        {activity.action === 'zap' 
                          ? `Received ${activity.amount} sats`
                          : 'View'
                        }
                      </div>
                      <div className="activity-time">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No recent activity</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MetricCard Component
 */
function MetricCard({ label, value, icon, trend, trendPercent }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {trend && (
        <div className={`metric-trend trend-${trend}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {Math.abs(trendPercent)}%
        </div>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
