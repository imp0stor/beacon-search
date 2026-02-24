/**
 * MediaViewer Component
 * Lightbox for viewing images and videos full-screen
 */

import React, { useState, useEffect } from 'react';
import './MediaViewer.css';

function MediaViewer({ mediaUrls, currentIndex = 0, onClose }) {
  const [index, setIndex] = useState(currentIndex);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const currentMedia = mediaUrls[index];
  const isVideo = currentMedia?.match(/\.(mp4|webm|mov)$/i);

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [index]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        setIndex((prev) => (prev > 0 ? prev - 1 : mediaUrls.length - 1));
      }
      if (e.key === 'ArrowRight') {
        setIndex((prev) => (prev < mediaUrls.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, mediaUrls.length]);

  const gotoPrevious = () => {
    setIndex((prev) => (prev > 0 ? prev - 1 : mediaUrls.length - 1));
  };

  const gotoNext = () => {
    setIndex((prev) => (prev < mediaUrls.length - 1 ? prev + 1 : 0));
  };

  const handleMediaLoad = () => {
    setLoading(false);
  };

  const handleMediaError = () => {
    setLoading(false);
    setError(true);
  };

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('media-viewer-backdrop')) {
      onClose();
    }
  };

  return (
    <div className="media-viewer-backdrop" onClick={handleBackdropClick}>
      <div className="media-viewer-container">
        {/* Close Button */}
        <button className="media-viewer-close" onClick={onClose} title="Close (Esc)">
          ✕
        </button>

        {/* Navigation */}
        {mediaUrls.length > 1 && (
          <>
            <button 
              className="media-viewer-nav prev" 
              onClick={gotoPrevious}
              title="Previous (←)"
            >
              ‹
            </button>
            <button 
              className="media-viewer-nav next" 
              onClick={gotoNext}
              title="Next (→)"
            >
              ›
            </button>
          </>
        )}

        {/* Media Content */}
        <div className="media-viewer-content">
          {loading && !error && (
            <div className="media-viewer-loading">
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
          )}

          {error && (
            <div className="media-viewer-error">
              <span className="icon">⚠️</span>
              <p>Failed to load media</p>
              <a href={currentMedia} target="_blank" rel="noopener noreferrer" className="media-viewer-link">
                Open in new tab
              </a>
            </div>
          )}

          {!error && (
            <>
              {isVideo ? (
                <video
                  src={currentMedia}
                  controls
                  autoPlay
                  className="media-viewer-video"
                  onLoadedData={handleMediaLoad}
                  onError={handleMediaError}
                />
              ) : (
                <img
                  src={currentMedia}
                  alt={`Media ${index + 1}`}
                  className="media-viewer-image"
                  style={{ display: loading ? 'none' : 'block' }}
                  onLoad={handleMediaLoad}
                  onError={handleMediaError}
                />
              )}
            </>
          )}
        </div>

        {/* Info Bar */}
        <div className="media-viewer-info">
          <div className="media-viewer-counter">
            {index + 1} / {mediaUrls.length}
          </div>
          <a 
            href={currentMedia} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="media-viewer-download"
            title="Open in new tab"
          >
            🔗 Open
          </a>
        </div>

        {/* Thumbnails */}
        {mediaUrls.length > 1 && mediaUrls.length <= 10 && (
          <div className="media-viewer-thumbnails">
            {mediaUrls.map((url, i) => (
              <div
                key={i}
                className={`thumbnail ${i === index ? 'active' : ''}`}
                onClick={() => setIndex(i)}
              >
                <img 
                  src={url} 
                  alt={`Thumbnail ${i + 1}`}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="50" height="50"%3E%3Crect fill="%23333" width="50" height="50"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E✕%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaViewer;
