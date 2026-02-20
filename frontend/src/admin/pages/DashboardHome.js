import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  fetchDashboardStats, 
  fetchSystemHealth, 
  fetchRecentActivity,
  clearCache,
  triggerSourceSync 
} from '../utils/api';

function DashboardHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refresh every 30s
    placeholderData: {
      totalDocuments: 0,
      totalSources: 0,
      recentSyncs: 0,
      searchesPerDay: 0,
      documentsChange: 0,
      sourcesChange: 0,
    },
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchSystemHealth,
    refetchInterval: 15000, // Refresh every 15s
    placeholderData: {
      database: 'unknown',
      redis: 'unknown',
      ollama: 'unknown',
      diskSpace: { used: 0, total: 1, percent: 0 },
    },
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: fetchRecentActivity,
    placeholderData: [],
  });

  // Mutations
  const clearCacheMutation = useMutation({
    mutationFn: clearCache,
    onSuccess: () => {
      queryClient.invalidateQueries();
      alert('Cache cleared successfully');
    },
    onError: (err) => alert('Failed to clear cache: ' + err.message),
  });

  const runSyncMutation = useMutation({
    mutationFn: () => triggerSourceSync('all'),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboard-stats']);
      alert('Sync triggered for all sources');
    },
  });

  const getHealthStatus = (service) => {
    const status = health?.[service];
    if (status === 'healthy' || status === 'connected' || status === true) return 'healthy';
    if (status === 'degraded' || status === 'warning') return 'degraded';
    return 'unhealthy';
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
  };

  const activityIcons = {
    sync: '🔄',
    document: '📄',
    source: '🔌',
    search: '🔍',
    error: '⚠️',
    config: '⚙️',
  };

  return (
    <div className="dashboard-home">
      {/* Page Header */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-subtitle">
          Monitor your search infrastructure and recent activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Documents</span>
            <span className="stat-icon">📄</span>
          </div>
          <div className="stat-value">{formatNumber(stats?.totalDocuments)}</div>
          {stats?.documentsChange !== 0 && (
            <div className={`stat-change ${stats?.documentsChange > 0 ? 'positive' : 'negative'}`}>
              {stats?.documentsChange > 0 ? '↑' : '↓'} {Math.abs(stats?.documentsChange)} today
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Active Sources</span>
            <span className="stat-icon">🔌</span>
          </div>
          <div className="stat-value">{formatNumber(stats?.totalSources)}</div>
          <div className="stat-change" style={{ color: 'var(--admin-text-muted)' }}>
            {stats?.activeSources || 0} connected
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Recent Syncs</span>
            <span className="stat-icon">🔄</span>
          </div>
          <div className="stat-value">{formatNumber(stats?.recentSyncs)}</div>
          <div className="stat-change" style={{ color: 'var(--admin-text-muted)' }}>
            Last 24 hours
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Searches / Day</span>
            <span className="stat-icon">🔍</span>
          </div>
          <div className="stat-value">{formatNumber(stats?.searchesPerDay)}</div>
          {stats?.searchesChange !== undefined && (
            <div className={`stat-change ${stats?.searchesChange >= 0 ? 'positive' : 'negative'}`}>
              {stats?.searchesChange >= 0 ? '↑' : '↓'} {Math.abs(stats?.searchesChange)}% vs yesterday
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* System Health */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">System Health</h3>
            <button 
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={() => queryClient.invalidateQueries(['system-health'])}
            >
              Refresh
            </button>
          </div>
          <div className="health-grid">
            <div className="health-item">
              <div className={`health-dot ${getHealthStatus('database')}`}></div>
              <span className="health-name">PostgreSQL</span>
            </div>
            <div className="health-item">
              <div className={`health-dot ${getHealthStatus('redis')}`}></div>
              <span className="health-name">Redis</span>
            </div>
            <div className="health-item">
              <div className={`health-dot ${getHealthStatus('ollama')}`}></div>
              <span className="health-name">Ollama</span>
            </div>
            <div className="health-item">
              <div className={`health-dot ${health?.diskSpace?.percent > 90 ? 'unhealthy' : health?.diskSpace?.percent > 75 ? 'degraded' : 'healthy'}`}></div>
              <span className="health-name">
                Disk ({health?.diskSpace?.percent || 0}%)
              </span>
            </div>
          </div>

          {/* Disk Space Bar */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: '0.75rem', 
              color: 'var(--admin-text-muted)',
              marginBottom: '0.375rem'
            }}>
              <span>Disk Usage</span>
              <span>
                {((health?.diskSpace?.used || 0) / 1e9).toFixed(1)}GB / 
                {((health?.diskSpace?.total || 1) / 1e9).toFixed(1)}GB
              </span>
            </div>
            <div style={{ 
              height: '8px', 
              background: 'var(--admin-bg-tertiary)', 
              borderRadius: '4px', 
              overflow: 'hidden' 
            }}>
              <div style={{ 
                height: '100%', 
                width: `${health?.diskSpace?.percent || 0}%`,
                background: health?.diskSpace?.percent > 90 ? 'var(--admin-danger)' : 
                           health?.diskSpace?.percent > 75 ? 'var(--admin-warning)' : 
                           'var(--admin-success)',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Quick Actions</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button 
              className="admin-btn admin-btn-primary"
              onClick={() => navigate('/admin/sources')}
              style={{ justifyContent: 'center' }}
            >
              <span>➕</span> New Source
            </button>
            <button 
              className="admin-btn admin-btn-secondary"
              onClick={() => runSyncMutation.mutate()}
              disabled={runSyncMutation.isPending}
              style={{ justifyContent: 'center' }}
            >
              <span>🔄</span> Run Sync
            </button>
            <button 
              className="admin-btn admin-btn-secondary"
              onClick={() => clearCacheMutation.mutate()}
              disabled={clearCacheMutation.isPending}
              style={{ justifyContent: 'center' }}
            >
              <span>🗑️</span> Clear Cache
            </button>
            <button 
              className="admin-btn admin-btn-secondary"
              onClick={() => navigate('/admin/documents')}
              style={{ justifyContent: 'center' }}
            >
              <span>📄</span> Documents
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Recent Activity</h3>
          <button 
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => queryClient.invalidateQueries(['recent-activity'])}
          >
            Refresh
          </button>
        </div>
        
        {activityLoading ? (
          <div className="admin-loading">
            <div className="admin-spinner"></div>
          </div>
        ) : activity?.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-state-icon">📋</div>
            <div className="admin-empty-state-text">No recent activity</div>
          </div>
        ) : (
          <div className="activity-feed">
            {(activity || []).slice(0, 10).map((item, idx) => (
              <div key={idx} className="activity-item">
                <div className="activity-icon" style={{
                  background: item.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)'
                }}>
                  {activityIcons[item.type] || '📌'}
                </div>
                <div className="activity-content">
                  <div className="activity-title">{item.message}</div>
                  <div className="activity-meta">
                    {item.source && <span>{item.source} • </span>}
                    {formatTimeAgo(item.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync Status Overview */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h3 className="admin-card-title">Source Sync Status</h3>
          <button 
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => navigate('/admin/sources')}
          >
            View All →
          </button>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Documents</th>
                <th>Last Sync</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentSourceStatus || []).slice(0, 5).map((source, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{source.name}</td>
                  <td>
                    <span className={`status-badge ${source.status}`}>
                      {source.status}
                    </span>
                  </td>
                  <td>{formatNumber(source.documentCount)}</td>
                  <td style={{ color: 'var(--admin-text-muted)', fontSize: '0.8125rem' }}>
                    {formatTimeAgo(source.lastSync)}
                  </td>
                </tr>
              ))}
              {(!stats?.recentSourceStatus || stats.recentSourceStatus.length === 0) && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                    No sources configured yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;
