-- Add content_type enum and column
CREATE TYPE content_type AS ENUM (
  'note', 'article', 'book', 'chapter', 'podcast_feed', 'podcast_episode',
  'kb_article', 'bounty', 'qa_thread', 'product', 'stall', 'git_repo',
  'web_page', 'github_repo', 'tv_episode', 'wiki'
);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_type content_type;
ALTER TABLE nostr_events ADD COLUMN IF NOT EXISTS content_type content_type;

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_documents_content_type ON documents(content_type);
CREATE INDEX IF NOT EXISTS idx_nostr_events_content_type ON nostr_events(content_type);
