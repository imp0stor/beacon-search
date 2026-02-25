const test = require('node:test');
const assert = require('node:assert');

const { BaseConnector } = require('../../dist/connectors/BaseConnector');

class DummyConnector extends BaseConnector {
  async connect() {}
  async disconnect() {}
  async testConnection() { return true; }
  async fetchDocuments() { return []; }
  async syncIncremental() { return { fetched: 0, indexed: 0, skipped: 0 }; }
  async syncFull() { return { fetched: 0, indexed: 0, skipped: 0 }; }
}

test('BaseConnector.transformDocument maps and validates data', () => {
  const fakePool = { query: async () => ({}) };
  const connector = new DummyConnector(fakePool, { id: 'srv-1', type: 'postgresql' }, {
    id: 'c1',
    name: 'crawler',
    type: 'product',
    server_id: 'srv-1',
    extraction_config: {},
    property_mapping: { product_id: 'externalId', product_title: 'title', product_body: 'content' },
  });

  const doc = connector.transformDocument({
    product_id: 'p-1',
    product_title: 'Widget',
    product_body: 'Useful widget',
  });

  assert.ok(doc);
  assert.equal(doc.externalId, 'p-1');
  assert.equal(doc.title, 'Widget');
  assert.equal(doc.content, 'Useful widget');
});

test('BaseConnector.transformDocument returns null for invalid rows', () => {
  const fakePool = { query: async () => ({}) };
  const connector = new DummyConnector(fakePool, { id: 'srv-1', type: 'postgresql' }, {
    id: 'c1',
    name: 'crawler',
    type: 'product',
    server_id: 'srv-1',
    extraction_config: {},
    property_mapping: {},
  });

  const doc = connector.transformDocument({ id: 'x' });
  assert.equal(doc, null);
});
