import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  fetchSearchAnalytics,
  fetchSyncAnalytics,
  fetchPopularSearches,
  fetchZeroResultQueries,
  fetchUserEngagement,
} from '../utils/api';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

const TIME_RANGES = [
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
];

function Analytics() {
  const [timeRange, setTimeRange] = useState('7d');

  // Fetch analytics data
  const { data: searchAnalytics, isLoading: searchLoading } = useQuery({
    queryKey: ['search-analytics', timeRange],
    queryFn: () => fetchSearchAnalytics({ range: timeRange }),
    placeholderData: {
      totalSearches: 0,
      avgResponseTime: 0,
      searchesByDay: [],
      searchesByHour: [],
    },
  });

  const { data: syncAnalytics, isLoading: syncLoading } = useQuery({
    queryKey: ['sync-analytics', timeRange],
    queryFn: () => fetchSyncAnalytics({ range: timeRange }),
    placeholderData: {
      totalSyncs: 0,
      documentsIndexed: 0,
      errorRate: 0,
      syncsByDay: [],
      docsBySource: [],
    },
  });

  const { data: popularSearches } = useQuery({
    queryKey: ['popular-searches', timeRange],
    queryFn: () => fetchPopularSearches({ range: timeRange, limit: 10 }),
    placeholderData: [],
  });

  const { data: zeroResults } = useQuery({
    queryKey: ['zero-results'],
    queryFn: fetchZeroResultQueries,
    placeholderData: [],
  });

  const { data: engagement } = useQuery({
    queryKey: ['user-engagement', timeRange],
    queryFn: fetchUserEngagement,
    placeholderData: {
      uniqueUsers: 0,
      sessionsPerUser: 0,
      avgSessionDuration: 0,
      usersByDay: [],
    },
  });

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--admin-bg-secondary)',
          border: '1px solid var(--admin-border)',
          padding: '0.75rem',
          borderRadius: '8px',
          fontSize: '0.8125rem',
        }}>
          <div style={{ marginBottom: '0.25rem', color: 'var(--admin-text-muted)' }}>{label}</div>
          {payload.map((p, idx) => (
            <div key={idx} style={{ color: p.color }}>
              {p.name}: {formatNumber(p.value)}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="analytics">
      {/* Page Header */}
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="admin-page-title">Analytics</h1>
          <p className="admin-page-subtitle">
            Search performance and usage insights
          </p>
        </div>
        <div className="admin-tabs" style={{ marginBottom: 0, background: 'var(--admin-bg-tertiary)' }}>
          {TIME_RANGES.map(range => (
            <button
              key={range.id}
              className={`admin-tab ${timeRange === range.id ? 'active' : ''}`}
              onClick={() => setTimeRange(range.id)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Searches</span>
            <span className="stat-icon">🔍</span>
          </div>
          <div className="stat-value">{formatNumber(searchAnalytics?.totalSearches)}</div>
          <div className="stat-change" style={{ color: 'var(--admin-text-muted)' }}>
            In selected period
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Avg Response Time</span>
            <span className="stat-icon">⚡</span>
          </div>
          <div className="stat-value">{searchAnalytics?.avgResponseTime || 0}ms</div>
          <div className="stat-change" style={{ color: 'var(--admin-text-muted)' }}>
            Median latency
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Documents Indexed</span>
            <span className="stat-icon">📄</span>
          </div>
          <div className="stat-value">{formatNumber(syncAnalytics?.documentsIndexed)}</div>
          <div className="stat-change" style={{ color: 'var(--admin-text-muted)' }}>
            {syncAnalytics?.totalSyncs || 0} syncs
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Unique Users</span>
            <span className="stat-icon">👥</span>
          </div>
          <div className="stat-value">{formatNumber(engagement?.uniqueUsers)}</div>
          <div className="stat-change" style={{ color: 'var(--admin-text-muted)' }}>
            {engagement?.sessionsPerUser?.toFixed(1) || 0} sessions/user
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Search Volume Chart */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Search Volume</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={searchAnalytics?.searchesByDay || []}>
                <defs>
                  <linearGradient id="searchGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="searches" 
                  stroke="#6366f1" 
                  fill="url(#searchGradient)" 
                  name="Searches"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Popular Searches */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Popular Searches</h3>
          </div>
          <div style={{ maxHeight: '280px', overflow: 'auto' }}>
            {(popularSearches || []).length === 0 ? (
              <div className="admin-empty-state" style={{ padding: '2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                <div style={{ fontSize: '0.875rem' }}>No search data yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {popularSearches.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '6px',
                  }}>
                    <span style={{ 
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--admin-accent)',
                      borderRadius: '50%',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      {idx + 1}
                    </span>
                    <span style={{ flex: 1, fontSize: '0.875rem' }}>{item.query}</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-muted)' }}>
                      {formatNumber(item.count)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Sync Activity */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Sync Activity</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={syncAnalytics?.syncsByDay || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="documents" fill="#10b981" name="Documents" radius={[4, 4, 0, 0]} />
                <Bar dataKey="errors" fill="#ef4444" name="Errors" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Documents by Source */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Documents by Source</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={syncAnalytics?.docsBySource || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="source"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {(syncAnalytics?.docsBySource || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Response Time Distribution */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Response Time (Hourly Average)</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={searchAnalytics?.searchesByHour || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} unit="ms" />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="avgTime" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false}
                  name="Response Time"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Zero Result Queries */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Zero-Result Queries</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
              Needs attention
            </span>
          </div>
          <div style={{ maxHeight: '280px', overflow: 'auto' }}>
            {(zeroResults || []).length === 0 ? (
              <div className="admin-empty-state" style={{ padding: '2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                <div style={{ fontSize: '0.875rem' }}>No zero-result queries!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {zeroResults.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px',
                  }}>
                    <span style={{ fontSize: '1rem' }}>❌</span>
                    <span style={{ flex: 1, fontSize: '0.875rem' }}>{item.query}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--admin-danger)' }}>
                      {item.count}×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {zeroResults?.length > 0 && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
              💡 Consider adding content or synonyms for these queries
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
