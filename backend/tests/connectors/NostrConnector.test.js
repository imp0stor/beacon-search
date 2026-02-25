const test = require('node:test');
const assert = require('node:assert');

const { NostrConnector } = require('../../dist/connectors/NostrConnector');

function buildConnector({ querySyncImpl, lastSyncAt = null } = {}) {
  const fakePool = {
    queries: [],
    async query(sql, params = []) {
      this.queries.push({ sql: sql.toLowerCase(), params });
      return { rows: [] };
    }
  };

  const connector = new NostrConnector(fakePool, {
    id: 'srv-1',
    type: 'nostr',
    metadata: { relays: ['wss://relay.damus.io'] },
  }, {
    id: 'cr-1',
    name: 'nostr',
    type: 'external',
    server_id: 'srv-1',
    extraction_config: { relays: ['wss://relay.damus.io'], limit: 10 },
    property_mapping: {},
    last_sync_at: lastSyncAt,
  });

  const calls = [];
  connector.relayPool.querySync = async (relays, filter) => {
    calls.push({ relays, filter });
    return querySyncImpl ? querySyncImpl(relays, filter) : [];
  };
  connector.relayPool.close = () => {};

  return { connector, fakePool, calls };
}

test('NostrConnector transforms kind 0 and kind 1 events', async () => {
  const { connector } = buildConnector();

  const profileDoc = connector.transformNostrEvent({
    id: 'evt1',
    pubkey: 'abcd'.repeat(16),
    kind: 0,
    content: JSON.stringify({ name: 'alice', about: 'builder' }),
    tags: [],
    created_at: 1700000000,
  });

  const noteDoc = connector.transformNostrEvent({
    id: 'evt2',
    pubkey: 'efgh'.repeat(16),
    kind: 1,
    content: 'hello nostr',
    tags: [['t', 'intro']],
    created_at: 1700000001,
  });

  assert.ok(profileDoc);
  assert.equal(profileDoc.documentType, 'nostr_profile');
  assert.equal(profileDoc.attributes.kind, 0);
  assert.ok(noteDoc);
  assert.equal(noteDoc.documentType, 'nostr_note');
  assert.equal(noteDoc.attributes.kind, 1);
});

test('NostrConnector uses object filters and indexes fetched events', async () => {
  const event = {
    id: 'evt-sync-1',
    pubkey: '1234'.repeat(16),
    kind: 1,
    content: 'beacon connector e2e',
    tags: [],
    created_at: 1700000010,
  };

  const { connector, fakePool, calls } = buildConnector({
    querySyncImpl: async (_relays, filter) => {
      assert.equal(typeof filter, 'object');
      assert.equal(Array.isArray(filter), false);
      if (filter.limit === 1) return [event]; // testConnection
      return [event]; // fetchDocuments
    }
  });

  const result = await connector.syncIncremental();

  assert.equal(result.fetched, 1);
  assert.equal(result.indexed, 1);
  assert.equal(result.skipped, 0);
  assert.equal(calls.length, 2);
  assert.equal(Array.isArray(calls[0].filter), false);
  assert.equal(Array.isArray(calls[1].filter), false);

  const docUpsert = fakePool.queries.find((q) => q.sql.includes('insert into documents'));
  assert.ok(docUpsert, 'expected indexed document upsert');

  const crawlerUpdate = fakePool.queries.filter((q) => q.sql.includes('update crawlers'));
  assert.ok(crawlerUpdate.length >= 1, 'expected crawler sync status update');
});

test('NostrConnector includes since for incremental sync when last_sync_at exists', async () => {
  const sinceDate = new Date('2026-02-24T00:00:00.000Z');
  const expectedSince = Math.floor(sinceDate.getTime() / 1000);

  const { connector, calls } = buildConnector({
    lastSyncAt: sinceDate,
    querySyncImpl: async (_relays, filter) => {
      if (filter.limit === 1) return [];
      return [];
    }
  });

  await connector.syncIncremental();

  const fetchCall = calls.find((c) => c.filter && c.filter.kinds && c.filter.limit === 10);
  assert.ok(fetchCall, 'expected fetchDocuments query call');
  assert.equal(fetchCall.filter.since, expectedSince);
});
