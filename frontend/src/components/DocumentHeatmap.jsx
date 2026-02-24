/**
 * DocumentHeatmap.jsx
 * 
 * Paragraph-level zap heatmap visualization for documents
 * Shows which sections received the most engagement (zaps)
 * 
 * Created: 2026-02-20 (P2 Features)
 */

import React, { useState, useEffect } from 'react';
import './DocumentHeatmap.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function DocumentHeatmap({ documentId }) {
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!documentId) return;

    const fetchHeatmap = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/api/documents/${documentId}/zap-heatmap`
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        setHeatmap(data);
      } catch (err) {
        console.error('Failed to fetch heatmap:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
  }, [documentId]);

  const getHeatColor = (percentage) => {
    if (percentage >= 40) return '#ff4444';  // Burning - red
    if (percentage >= 20) return '#ff9944';  // Hot - orange
    if (percentage >= 10) return '#ffcc44';  // Warm - yellow
    if (percentage > 0) return '#ccddff';    // Cold - light blue
    return '#f0f0f0';                         // No zaps - gray
  };

  const getHeatLabel = (percentage) => {
    if (percentage >= 40) return 'burning';
    if (percentage >= 20) return 'hot';
    if (percentage >= 10) return 'warm';
    if (percentage > 0) return 'cold';
    return 'none';
  };

  if (loading) {
    return <div className="heatmap-container"><div className="loading">Loading heatmap...</div></div>;
  }

  if (error) {
    return <div className="heatmap-container"><div className="error">Error: {error}</div></div>;
  }

  if (!heatmap) {
    return <div className="heatmap-container"><div className="empty-state">No heatmap data</div></div>;
  }

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <h3>{heatmap.title}</h3>
        <div className="heatmap-stats">
          <span className="stat">⚡ {heatmap.totalZaps} zaps</span>
          <span className="stat">💰 {heatmap.totalSats} sats</span>
        </div>
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ff4444' }}></div>
          <span>Burning (40%+)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ff9944' }}></div>
          <span>Hot (20%+)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ffcc44' }}></div>
          <span>Warm (10%+)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ccddff' }}></div>
          <span>Cold (1%+)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#f0f0f0' }}></div>
          <span>No zaps</span>
        </div>
      </div>

      {/* Hotspots Section */}
      {heatmap.hotspots && heatmap.hotspots.length > 0 && (
        <div className="hotspots-section">
          <h4>Top Hotspots</h4>
          <div className="hotspots-list">
            {heatmap.hotspots.map((hotspot, idx) => (
              <div key={idx} className="hotspot-item">
                <div className="hotspot-rank">#{idx + 1}</div>
                <div className="hotspot-heat" style={{ backgroundColor: getHeatColor(hotspot.percentageOfTotal) }}>
                  {getHeatLabel(hotspot.percentageOfTotal)}
                </div>
                <div className="hotspot-info">
                  <div className="hotspot-para">Paragraph {hotspot.paragraphIndex}</div>
                  <div className="hotspot-percent">{hotspot.percentageOfTotal.toFixed(1)}% of total zaps</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paragraph Heatmap */}
      {heatmap.paragraphs && heatmap.paragraphs.length > 0 && (
        <div className="paragraphs-section">
          <h4>Paragraph-by-Paragraph Breakdown</h4>
          <div className="paragraphs-list">
            {heatmap.paragraphs.map((para, idx) => (
              <div
                key={idx}
                className="paragraph-block"
                style={{
                  backgroundColor: getHeatColor(para.percentageOfTotal),
                  borderLeftColor: getHeatColor(para.percentageOfTotal)
                }}
              >
                <div className="paragraph-index">¶ {para.index}</div>
                <div className="paragraph-stats">
                  <span className="para-zaps">⚡ {para.zapCount}</span>
                  <span className="para-sats">💰 {para.totalSats}</span>
                  <span className="para-percent">{para.percentageOfTotal.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peak Paragraph */}
      {heatmap.peakParagraph && (
        <div className="peak-section">
          <h4>🔥 Peak Engagement</h4>
          <div className="peak-card">
            <div className="peak-para">Paragraph {heatmap.peakParagraph.index}</div>
            <div className="peak-stats">
              <div className="peak-stat">
                <div className="peak-label">Zaps</div>
                <div className="peak-value">{heatmap.peakParagraph.zapCount}</div>
              </div>
              <div className="peak-stat">
                <div className="peak-label">Sats</div>
                <div className="peak-value">{heatmap.peakParagraph.totalSats}</div>
              </div>
              <div className="peak-stat">
                <div className="peak-label">Percentage</div>
                <div className="peak-value">{heatmap.peakParagraph.percentageOfTotal.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(!heatmap.paragraphs || heatmap.paragraphs.length === 0) && (
        <div className="empty-state">No paragraph heatmap data yet</div>
      )}
    </div>
  );
}

export default DocumentHeatmap;
