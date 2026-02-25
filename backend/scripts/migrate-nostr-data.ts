import { Pool } from 'pg';

async function migrate(): Promise<void> {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'beacon_search',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await pool.query('BEGIN');

    const serverRes = await pool.query(
      `INSERT INTO servers (name, type, metadata, auth_type, auth_config, created_at, updated_at)
       VALUES ('Default Nostr Relay Server', 'nostr', $1::jsonb, 'none', '{}'::jsonb, NOW(), NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [JSON.stringify({ managed_by: 'migrate-nostr-data', relays: ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nostr.wine'] })]
    );

    const existingServerRes = await pool.query(
      `SELECT id FROM servers
       WHERE type = 'nostr'
       ORDER BY created_at ASC
       LIMIT 1`
    );
    const serverId = serverRes.rows[0]?.id || existingServerRes.rows[0]?.id;

    if (!serverId) {
      throw new Error('Unable to create/find Nostr server record');
    }

    await pool.query(
      `INSERT INTO crawlers (
        name, type, server_id, status, schedule_type, extraction_config, property_mapping, access_control, created_at, updated_at
      )
      VALUES (
        'Default Nostr Connector',
        'product',
        $1,
        'active',
        'manual',
        $2::jsonb,
        $3::jsonb,
        '{}'::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING`,
      [
        serverId,
        JSON.stringify({ relays: ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nostr.wine'], kinds: [0, 1], mode: 'incremental' }),
        JSON.stringify({ id: 'externalId', content: 'content', title: 'title', created_at: 'lastModified' }),
      ]
    );

    const hasSourceId = await pool.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'documents'
        AND column_name = 'source_id'
      LIMIT 1
    `);

    if (hasSourceId.rowCount > 0) {
      const updateRes = await pool.query(
        `UPDATE documents
         SET source_id = $1,
             document_type = COALESCE(document_type, 'nostr_note'),
             attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object('migrated_by', 'migrate-nostr-data', 'nostr', true),
             updated_at = NOW()
         WHERE (attributes->>'nostr' = 'true' OR external_id IS NOT NULL)
           AND source_id IS NULL`,
        [serverId]
      );
      console.log(`Migrated ${updateRes.rowCount} documents to default Nostr source_id`);
    }

    await pool.query('COMMIT');
    console.log('Nostr migration complete. Existing data preserved.');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Nostr migration failed:', error);
  process.exit(1);
});
