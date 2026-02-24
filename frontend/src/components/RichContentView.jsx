/**
 * RichContentView.jsx
 *
 * 3-level expansion for Beacon Search result cards:
 *   Level 0 — Collapsed: title + 3-line preview + source badge + Expand button
 *   Level 1 — Expanded:  full plain text + timestamps + tags + "Show rich view" button
 *   Level 2 — Rich:      full markdown, inline images (lazy), link preview cards,
 *                         author avatar + name + NIP-05, timestamps, related tags
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './RichContentView.css';
import {
  extractMedia,
  extractHashtags,
  truncateLines,
  stripMediaUrls,
} from '../utils/contentParser';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  if (isNaN(d.getTime())) return null;

  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function shortenNpub(npub) {
  if (!npub || npub.length < 16) return npub;
  return `${npub.slice(0, 8)}…${npub.slice(-4)}`;
}

const SOURCE_ICONS = {
  nostr: '🟣',
  web: '🌐',
  rss: '📡',
  github: '🐙',
  confluence: '📘',
  notion: '📝',
  slack: '💬',
  default: '📄',
};

function getSourceIcon(sourceType) {
  return SOURCE_ICONS[sourceType?.toLowerCase()] || SOURCE_ICONS.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SourceBadge — inline badge showing source icon + short name.
 */
function SourceBadge({ sourceId, sourceType, sourceName }) {
  const icon = getSourceIcon(sourceType);
  const label = sourceName || (sourceId ? sourceId.slice(0, 8) : null) || sourceType || 'Unknown';
  return (
    <span className="rcv-source-badge" title={`Source: ${label}`}>
      <span className="rcv-source-icon">{icon}</span>
      <span className="rcv-source-name">{label}</span>
    </span>
  );
}

/**
 * AuthorRow — shows avatar, name, and NIP-05 identifier.
 */
function AuthorRow({ author, authorPubkey, nip05, avatarUrl }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="rcv-author-row">
      <div className="rcv-avatar">
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={author || 'Author'}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="rcv-avatar-fallback">
            {(author || authorPubkey || '?')[0].toUpperCase()}
          </span>
        )}
      </div>
      <div className="rcv-author-info">
        {author && <span className="rcv-author-name">{author}</span>}
        {nip05 && <span className="rcv-nip05">✓ {nip05}</span>}
        {!author && authorPubkey && (
          <span className="rcv-author-pubkey" title={authorPubkey}>
            {shortenNpub(authorPubkey)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * LazyImage — lazy-loaded image with placeholder and error fallback.
 */
function LazyImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          imgRef.current.src = src;
        }
      },
      { rootMargin: '200px' }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [src]);

  if (error) {
    return (
      <div className="rcv-img-error" title={src}>
        🖼️ Image unavailable
      </div>
    );
  }

  return (
    <div className={`rcv-img-wrap ${loaded ? 'loaded' : 'loading'}`}>
      {!loaded && <div className="rcv-img-placeholder" />}
      <img
        ref={imgRef}
        alt={alt || ''}
        className="rcv-lazy-img"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{ display: loaded ? 'block' : 'none' }}
      />
    </div>
  );
}

/**
 * MediaGallery — responsive grid of lazy-loaded images.
 * 1 → full width; 2 → 2-col; 3 → 2+1; 4 → 2×2; 5+ → 2×2 + overlay.
 */
function MediaGallery({ images }) {
  const MAX_VISIBLE = 4;
  const visible = images.slice(0, MAX_VISIBLE);
  const overflow = images.length - MAX_VISIBLE;

  return (
    <div className={`rcv-gallery rcv-gallery-${Math.min(images.length, 5)}`}>
      {visible.map((src, i) => (
        <div key={i} className="rcv-gallery-cell">
          <LazyImage src={src} alt={`Image ${i + 1}`} />
        </div>
      ))}
      {overflow > 0 && (
        <div className="rcv-gallery-cell rcv-gallery-overflow">
          <LazyImage src={images[MAX_VISIBLE]} alt={`Image ${MAX_VISIBLE + 1}`} />
          <div className="rcv-overflow-overlay">+{overflow} more</div>
        </div>
      )}
    </div>
  );
}

/**
 * VideoEmbed — YouTube embed or native video player.
 */
function VideoEmbed({ src, youtubeId }) {
  if (youtubeId) {
    return (
      <div className="rcv-youtube-wrap">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="rcv-youtube"
        />
      </div>
    );
  }
  return (
    <video controls className="rcv-video" preload="metadata">
      <source src={src} />
      Your browser does not support this video.
    </video>
  );
}

/**
 * LinkPreviewCard — fetches og: meta from a URL and renders a card.
 * Falls back to a plain link if fetch fails or CORS blocks it.
 */
function LinkPreviewCard({ url }) {
  const [meta, setMeta] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    setFetching(true);
    // We use a simple all-origins proxy to handle CORS.
    // If that fails, fall back to plain link.
    const proxied = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    fetch(proxied, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((data) => {
        const html = data.contents || '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const getOg = (prop) =>
          doc.querySelector(`meta[property="${prop}"]`)?.content ||
          doc.querySelector(`meta[name="${prop}"]`)?.content || '';
        const title = getOg('og:title') || doc.title || '';
        const description = getOg('og:description') || getOg('description') || '';
        const image = getOg('og:image') || '';
        const siteName = getOg('og:site_name') || new URL(url).hostname;
        if (title) {
          setMeta({ title, description, image, siteName });
        } else {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true))
      .finally(() => setFetching(false));
  }, [url]);

  if (fetching) {
    return (
      <div className="rcv-link-preview loading">
        <a href={url} target="_blank" rel="noopener noreferrer" className="rcv-link">
          {url}
        </a>
      </div>
    );
  }

  if (failed || !meta) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="rcv-link">
        🔗 {url}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="rcv-link-preview"
    >
      {meta.image && (
        <div className="rcv-preview-img-wrap">
          <img src={meta.image} alt="" className="rcv-preview-img" loading="lazy" />
        </div>
      )}
      <div className="rcv-preview-body">
        <div className="rcv-preview-site">{meta.siteName}</div>
        <div className="rcv-preview-title">{meta.title}</div>
        {meta.description && (
          <div className="rcv-preview-desc">{meta.description.slice(0, 120)}</div>
        )}
      </div>
    </a>
  );
}

/**
 * TagList — renders inline tag chips.
 */
function TagList({ tags, onTagClick }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="rcv-tag-list">
      {tags.map((tag) => (
        <button
          key={tag}
          className="rcv-tag"
          onClick={(e) => { e.stopPropagation(); onTagClick && onTagClick(tag); }}
          type="button"
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RichContentView
 *
 * Props:
 *   document     {object}   — the search result / document object
 *   sourceNameLookup {Map}  — optional map of source_id → display name
 *   onTagClick   {fn}       — optional callback when a tag is clicked
 *   defaultLevel {0|1|2}   — initial expansion level (default 0)
 */
function RichContentView({
  document: doc,
  sourceNameLookup,
  onTagClick,
  defaultLevel = 0,
}) {
  const [level, setLevel] = useState(defaultLevel);

  const content = doc?.content || '';
  const title = doc?.title || '(Untitled)';

  // Tags: support multiple shapes
  const docTags = (() => {
    const raw = [];
    if (Array.isArray(doc?.tags)) {
      doc.tags.forEach((t) => {
        if (typeof t === 'string') raw.push(t);
        else if (t?.tag) raw.push(t.tag);
      });
    }
    if (Array.isArray(doc?.metadata?.tags)) raw.push(...doc.metadata.tags);
    // Also parse inline hashtags from content
    const inline = extractHashtags(content);
    return [...new Set([...raw, ...inline])].slice(0, 12);
  })();

  const media = extractMedia(content);
  const hasMedia = media.images.length > 0 || media.videos.length > 0 || media.youtubeIds.length > 0;
  const hasLinkPreviews = !hasMedia && /https?:\/\//.test(content);

  // Timestamps
  const createdAt = doc?.created_at || doc?.metadata?.created_at || doc?.attributes?.created_at;
  const updatedAt = doc?.updated_at || doc?.metadata?.updated_at;

  // Source info
  const sourceId = doc?.source_id;
  const sourceName = sourceId ? sourceNameLookup?.get(sourceId) : null;
  const sourceType = doc?.source_type || doc?.type || doc?.attributes?.source_type;

  // Author / Nostr metadata
  const author = doc?.author || doc?.metadata?.author || doc?.attributes?.author_name;
  const authorPubkey = doc?.attributes?.pubkey || doc?.metadata?.pubkey;
  const nip05 = doc?.attributes?.nip05 || doc?.metadata?.nip05;
  const avatarUrl = doc?.attributes?.picture || doc?.metadata?.picture || doc?.attributes?.avatar;

  // Clean text for markdown (strip bare media URLs to avoid double-rendering)
  const cleanedContent = stripMediaUrls(content);

  // Preview: 3-line truncation
  const preview = truncateLines(content, 3, 85);

  const expand = useCallback((e) => {
    e.stopPropagation();
    setLevel(1);
  }, []);

  const showRich = useCallback((e) => {
    e.stopPropagation();
    setLevel(2);
  }, []);

  const collapse = useCallback((e) => {
    e.stopPropagation();
    setLevel(0);
  }, []);

  // ── Level 0: Collapsed ──────────────────────────────────────────────────────
  if (level === 0) {
    return (
      <div className="rcv rcv-level-0">
        <div className="rcv-header">
          <h3 className="rcv-title">
            {doc?.url ? (
              <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                {title}
              </a>
            ) : title}
          </h3>
          {(sourceId || sourceType) && (
            <SourceBadge sourceId={sourceId} sourceType={sourceType} sourceName={sourceName} />
          )}
        </div>

        {preview && <p className="rcv-preview">{preview}</p>}

        <div className="rcv-actions">
          <button className="rcv-btn rcv-btn-expand" onClick={expand} type="button">
            ▼ Expand
          </button>
        </div>
      </div>
    );
  }

  // ── Level 1: Expanded ───────────────────────────────────────────────────────
  if (level === 1) {
    return (
      <div className="rcv rcv-level-1" onClick={(e) => e.stopPropagation()}>
        <div className="rcv-header">
          <h3 className="rcv-title">
            {doc?.url ? (
              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                {title}
              </a>
            ) : title}
          </h3>
          {(sourceId || sourceType) && (
            <SourceBadge sourceId={sourceId} sourceType={sourceType} sourceName={sourceName} />
          )}
        </div>

        <p className="rcv-full-text">{content}</p>

        <div className="rcv-meta-row">
          {createdAt && (
            <span className="rcv-timestamp" title={new Date(createdAt).toISOString()}>
              🕐 {formatTimestamp(createdAt)}
            </span>
          )}
          {updatedAt && updatedAt !== createdAt && (
            <span className="rcv-timestamp" title={new Date(updatedAt).toISOString()}>
              ✏️ {formatTimestamp(updatedAt)}
            </span>
          )}
        </div>

        <TagList tags={docTags} onTagClick={onTagClick} />

        <div className="rcv-actions">
          <button className="rcv-btn rcv-btn-rich" onClick={showRich} type="button">
            ✨ Show rich view
          </button>
          <button className="rcv-btn rcv-btn-collapse" onClick={collapse} type="button">
            ▲ Collapse
          </button>
        </div>
      </div>
    );
  }

  // ── Level 2: Rich View ──────────────────────────────────────────────────────
  return (
    <div className="rcv rcv-level-2" onClick={(e) => e.stopPropagation()}>
      {/* Author row */}
      {(author || authorPubkey) && (
        <AuthorRow
          author={author}
          authorPubkey={authorPubkey}
          nip05={nip05}
          avatarUrl={avatarUrl}
        />
      )}

      {/* Header */}
      <div className="rcv-header">
        <h3 className="rcv-title">
          {doc?.url ? (
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              {title}
            </a>
          ) : title}
        </h3>
        {(sourceId || sourceType) && (
          <SourceBadge sourceId={sourceId} sourceType={sourceType} sourceName={sourceName} />
        )}
      </div>

      {/* Timestamps */}
      <div className="rcv-meta-row">
        {createdAt && (
          <span className="rcv-timestamp" title={new Date(createdAt).toISOString()}>
            🕐 {formatTimestamp(createdAt)}
          </span>
        )}
        {updatedAt && updatedAt !== createdAt && (
          <span className="rcv-timestamp" title={new Date(updatedAt).toISOString()}>
            ✏️ Updated {formatTimestamp(updatedAt)}
          </span>
        )}
      </div>

      {/* Markdown-rendered content */}
      <div className="rcv-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            img: ({ src, alt }) => <LazyImage src={src} alt={alt} />,
          }}
        >
          {cleanedContent}
        </ReactMarkdown>
      </div>

      {/* Image gallery */}
      {media.images.length > 0 && (
        <div className="rcv-media-section">
          <MediaGallery images={media.images} />
        </div>
      )}

      {/* Video embeds */}
      {(media.videos.length > 0 || media.youtubeIds.length > 0) && (
        <div className="rcv-media-section">
          {media.youtubeIds.map((id) => (
            <VideoEmbed key={id} youtubeId={id} />
          ))}
          {media.videos.map((src) => (
            <VideoEmbed key={src} src={src} />
          ))}
        </div>
      )}

      {/* Link preview cards — only if no media detected */}
      {!hasMedia && (() => {
        const urlMatches = (content.match(/https?:\/\/[^\s<>"')\]]+/gi) || [])
          .filter((u) => !/\.(jpe?g|png|gif|webp|svg|avif|mp4|webm|ogg|mov)(\?|$)/i.test(u))
          .slice(0, 3);
        if (urlMatches.length === 0) return null;
        return (
          <div className="rcv-link-previews">
            {urlMatches.map((url) => (
              <LinkPreviewCard key={url} url={url} />
            ))}
          </div>
        );
      })()}

      {/* Tags */}
      <TagList tags={docTags} onTagClick={onTagClick} />

      {/* Actions */}
      <div className="rcv-actions">
        <button className="rcv-btn rcv-btn-collapse" onClick={collapse} type="button">
          ▲ Collapse
        </button>
      </div>
    </div>
  );
}

export default RichContentView;
