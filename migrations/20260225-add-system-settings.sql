BEGIN;

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR PRIMARY KEY,
  value JSONB NOT NULL,
  category VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (key, value, category, description)
VALUES
  ('OPENAI_API_KEY', to_jsonb(''::text), 'openai', 'OpenAI API key for RAG and assistant responses'),
  ('OPENAI_MODEL', to_jsonb('gpt-4o-mini'::text), 'openai', 'OpenAI chat completion model for answer generation'),
  ('WOT_ENABLED', to_jsonb(false), 'wot', 'Enable Web of Trust score boosting in search ranking'),
  ('WOT_PROVIDER', to_jsonb('local'::text), 'wot', 'WoT provider (local or nostrmaxi)'),
  ('NOSTRMAXI_URL', to_jsonb('http://localhost:3000'::text), 'wot', 'NostrMaxi service URL when WoT provider is nostrmaxi'),
  ('WOT_WEIGHT', to_jsonb(1.0), 'wot', 'WoT score weight multiplier for ranking boost'),
  ('WOT_CACHE_TTL', to_jsonb(3600), 'wot', 'WoT score cache TTL in seconds')
ON CONFLICT (key) DO NOTHING;

COMMIT;
