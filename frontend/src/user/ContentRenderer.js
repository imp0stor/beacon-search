import React, { useState, useEffect } from 'react';

// Parse and render rich content with embeds
function ContentRenderer({ content }) {
  const [linkPreviews, setLinkPreviews] = useState({});
  const [loadingPreviews, setLoadingPreviews] = useState(new Set());

  if (!content) return null;

  // Extract URLs from content
  const extractUrls = (text) => {
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const urls = [];
    let match;
    while ((match = urlPattern.exec(text)) !== null) {
      urls.push(match[0]);
    }
    return urls;
  };

  // Fetch link preview for a URL
  const fetchLinkPreview = async (url) => {
    if (loadingPreviews.has(url) || linkPreviews[url]) return;
    
    setLoadingPreviews(prev => new Set(prev).add(url));
    
    try {
      const res = await fetch('/api/link-preview?url=' + encodeURIComponent(url));
      if (res.ok) {
        const data = await res.json();
        setLinkPreviews(prev => ({ ...prev, [url]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch preview for', url, err);
    } finally {
      setLoadingPreviews(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };

  // Load previews for all URLs
  useEffect(() => {
    const urls = extractUrls(content);
    urls.forEach(url => fetchLinkPreview(url));
  }, [content]);

  const renderContent = () => {
    const parts = [];
    let lastIndex = 0;
    
    // Regex patterns
    const imagePattern = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s]*)?)/gi;
    const urlPattern = /(https?:\/\/[^\s]+)/gi;
    const nostrEventPattern = /(nostr:)?(?:note1|nevent1|nprofile1|naddr1)([a-z0-9]+)/gi;
    const nostrHexPattern = /nostr:([0-9a-f]{64})/gi;
    
    // Find all images first
    const images = [];
    let imageMatch;
    imagePattern.lastIndex = 0;
    while ((imageMatch = imagePattern.exec(content)) !== null) {
      images.push({
        url: imageMatch[0],
        index: imageMatch.index,
        length: imageMatch[0].length
      });
    }
    
    // Find all URLs (excluding images)
    const urls = [];
    let urlMatch;
    urlPattern.lastIndex = 0;
    while ((urlMatch = urlPattern.exec(content)) !== null) {
      const isImage = images.some(img => img.index === urlMatch.index);
      if (!isImage) {
        urls.push({
          url: urlMatch[0],
          index: urlMatch.index,
          length: urlMatch[0].length
        });
      }
    }
    
    // Find Nostr references
    const nostrRefs = [];
    
    let bechMatch;
    nostrEventPattern.lastIndex = 0;
    while ((bechMatch = nostrEventPattern.exec(content)) !== null) {
      nostrRefs.push({
        text: bechMatch[0],
        index: bechMatch.index,
        length: bechMatch[0].length,
        type: 'bech32'
      });
    }
    
    let hexMatch;
    nostrHexPattern.lastIndex = 0;
    while ((hexMatch = nostrHexPattern.exec(content)) !== null) {
      const eventId = hexMatch[1];
      nostrRefs.push({
        text: hexMatch[0],
        eventId: eventId,
        index: hexMatch.index,
        length: hexMatch[0].length,
        type: 'hex'
      });
    }
    
    // Combine all matches and sort by index
    const allMatches = [
      ...images.map(m => ({ ...m, type: 'image' })),
      ...urls.map(m => ({ ...m, type: 'url' })),
      ...nostrRefs.map(m => ({ ...m, type: m.type === 'hex' ? 'nostr-hex' : 'nostr-bech32' }))
    ].sort((a, b) => a.index - b.index);
    
    // Remove overlapping matches (prefer first match)
    const filteredMatches = [];
    let lastEnd = 0;
    for (const match of allMatches) {
      if (match.index >= lastEnd) {
        filteredMatches.push(match);
        lastEnd = match.index + match.length;
      }
    }
    
    // Build rendered output
    filteredMatches.forEach((match, idx) => {
      // Add text before this match
      if (match.index > lastIndex) {
        parts.push(
          <span key={'text-' + idx}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }
      
      // Add the match element
      if (match.type === 'image') {
        parts.push(
          <div key={'img-' + idx} className="embedded-image">
            <img src={match.url} alt="Content" loading="lazy" />
          </div>
        );
      } else if (match.type === 'url') {
        const preview = linkPreviews[match.url];
        const displayUrl = match.url.length > 50 
          ? match.url.slice(0, 50) + '...' 
          : match.url;
        
        parts.push(
          <div key={'url-' + idx} className="link-container">
            <a 
              href={match.url} 
              target="_blank" 
              rel="noreferrer"
              className="embedded-link"
              title={match.url}
            >
              🔗 {displayUrl}
            </a>
            
            {preview && (
              <div className="link-preview-card">
                {preview.image && (
                  <div className="preview-image">
                    <img src={preview.image} alt={preview.title || 'Preview'} />
                  </div>
                )}
                <div className="preview-content">
                  <h4>{preview.title || preview.url}</h4>
                  {preview.description && (
                    <p className="preview-description">{preview.description}</p>
                  )}
                  <span className="preview-domain">{preview.domain || new URL(match.url).hostname}</span>
                </div>
              </div>
            )}
            
            {loadingPreviews.has(match.url) && (
              <div className="link-preview-card loading">
                <div className="preview-skeleton">
                  <div className="skeleton-title"></div>
                  <div className="skeleton-text"></div>
                  <div className="skeleton-text short"></div>
                </div>
              </div>
            )}
          </div>
        );
      } else if (match.type === 'nostr-hex') {
        parts.push(
          <a
            key={'nostr-' + idx}
            href={'https://primal.net/e/' + match.eventId}
            target="_blank"
            rel="noreferrer"
            className="nostr-mention"
            title={'Nostr event: ' + match.eventId.slice(0, 16) + '...'}
          >
            ⚡ {match.eventId.slice(0, 8)}...
          </a>
        );
      } else if (match.type === 'nostr-bech32') {
        parts.push(
          <a
            key={'nostr-' + idx}
            href={'https://primal.net/' + match.text}
            target="_blank"
            rel="noreferrer"
            className="nostr-mention"
            title={match.text}
          >
            ⚡ {match.text.slice(0, 16)}...
          </a>
        );
      }
      
      lastIndex = match.index + match.length;
    });
    
    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key="text-end">
          {content.slice(lastIndex)}
        </span>
      );
    }
    
    return parts.length > 0 ? parts : content;
  };

  return (
    <div className="rich-content">
      {renderContent()}
    </div>
  );
}

export default ContentRenderer;
