-- Foundation Rebuild (Phase 1) seed data

BEGIN;

INSERT INTO servers (
  id, name, type, host, port, database_name, auth_type, auth_config, metadata
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Primary PostgreSQL',
    'postgresql',
    'localhost',
    5432,
    'app_data',
    'password',
    '{"username":"app_reader","password":"***"}'::jsonb,
    '{"environment":"development","owner":"platform"}'::jsonb
  ),
  (
    '11111111-1111-1111-1111-111111111112',
    'Nostr Relay Pool',
    'nostr',
    NULL,
    NULL,
    NULL,
    'none',
    '{}'::jsonb,
    '{"relays":["wss://relay.damus.io","wss://relay.nostr.band"]}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_types (
  id, name, display_name, description, fields, display_template, relevancy_config
) VALUES
  (
    '22222222-2222-2222-2222-222222222221',
    'kb_article',
    'Knowledge Base Article',
    'Structured internal knowledge articles',
    '[
      {"name":"title","type":"string","required":true,"searchable":true},
      {"name":"summary","type":"text","required":false,"searchable":true},
      {"name":"tags","type":"array","required":false,"searchable":true}
    ]'::jsonb,
    '{{title}}\n{{summary}}',
    '{"boost":{"title":2.0,"tags":1.2}}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'nostr_event',
    'Nostr Event',
    'Normalized events fetched from relays',
    '[
      {"name":"event_id","type":"string","required":true,"searchable":true},
      {"name":"pubkey","type":"string","required":true,"searchable":true},
      {"name":"content","type":"text","required":false,"searchable":true}
    ]'::jsonb,
    '{{pubkey}}: {{content}}',
    '{"boost":{"content":1.4}}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO crawlers (
  id,
  name,
  type,
  server_id,
  document_type_id,
  status,
  schedule_type,
  schedule_config,
  extraction_config,
  property_mapping,
  access_control,
  last_sync_at,
  last_sync_status,
  last_sync_error
) VALUES
  (
    '33333333-3333-3333-3333-333333333331',
    'KB SQL Sync',
    'product',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222221',
    'active',
    'cron',
    '{"cron":"0 */6 * * *"}'::jsonb,
    '{"query":"SELECT id, title, summary, tags, updated_at FROM knowledge_articles"}'::jsonb,
    '{"id":"external_id","title":"title","summary":"content"}'::jsonb,
    '{"groups":["internal","ops"],"visibility":"private"}'::jsonb,
    NOW() - INTERVAL '30 minutes',
    'success',
    NULL
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    'Nostr Relay Sync',
    'external',
    '11111111-1111-1111-1111-111111111112',
    '22222222-2222-2222-2222-222222222222',
    'inactive',
    'manual',
    '{"mode":"on-demand"}'::jsonb,
    '{"kinds":[1,30023],"limit":500}'::jsonb,
    '{"id":"event_id","pubkey":"author","content":"content"}'::jsonb,
    '{"groups":["public"],"visibility":"public"}'::jsonb,
    NULL,
    NULL,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO sync_history (
  id,
  crawler_id,
  started_at,
  completed_at,
  status,
  documents_added,
  documents_updated,
  documents_deleted,
  error_message,
  metadata
) VALUES
  (
    '44444444-4444-4444-4444-444444444441',
    '33333333-3333-3333-3333-333333333331',
    NOW() - INTERVAL '35 minutes',
    NOW() - INTERVAL '30 minutes',
    'success',
    12,
    34,
    1,
    NULL,
    '{"duration_ms":31245,"trigger":"scheduler"}'::jsonb
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '33333333-3333-3333-3333-333333333332',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour 55 minutes',
    'failed',
    0,
    0,
    0,
    'Relay timeout while fetching event batch',
    '{"duration_ms":284000,"relay":"wss://relay.nostr.band"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO system_alerts (
  id,
  type,
  severity,
  message,
  source,
  acknowledged,
  acknowledged_by,
  acknowledged_at,
  created_at
) VALUES
  (
    '55555555-5555-5555-5555-555555555551',
    'sync_failure',
    'warning',
    'Nostr Relay Sync failed in last run',
    'Nostr Relay Sync',
    FALSE,
    NULL,
    NULL,
    NOW() - INTERVAL '1 hour 50 minutes'
  ),
  (
    '55555555-5555-5555-5555-555555555552',
    'performance',
    'info',
    'KB SQL Sync completed under SLA',
    'KB SQL Sync',
    TRUE,
    'admin@beacon.local',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '30 minutes'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
