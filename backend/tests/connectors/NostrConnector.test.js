const test = require('node:test');
const assert = require('node:assert');

const { NostrConnector } = require('../../dist/connectors/NostrConnector');

test('NostrConnector transforms kind 0 and kind 1 events', async () => {
  const fakePool = { query: async () => ({ rows: [] }) };
  const connector = new NostrConnector(fakePool, {
    id: 'srv-1',
    type: 'nostr',
    metadata: { relays: ['wss://relay.example'] },
  }, {
    id: 'cr-1',
    name: 'nostr',
    type: 'product',
    server_id: 'srv-1',
    extraction_config: { relays: ['wss://relay.example'] },
    property_mapping: {},
  });

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
