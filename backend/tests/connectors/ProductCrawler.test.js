const test = require('node:test');
const assert = require('node:assert');

const { ProductCrawler } = require('../../dist/connectors/ProductCrawler');

test('ProductCrawler builds incremental query and transforms rows', async () => {
  const fakeInternalPool = {
    query: async (sql) => {
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
      return {
        rows: [
          { id: '1', title: 'A', content: 'alpha', modified_at: '2026-02-01T00:00:00Z' },
          { id: '2', title: '', content: 'invalid', modified_at: '2026-02-01T00:00:00Z' },
        ],
      };
    },
    end: async () => {},
  };

  const fakePool = {
    query: async () => ({ rows: [] }),
  };

  const crawler = new ProductCrawler(fakePool, { id: 'srv-1', type: 'postgresql' }, {
    id: 'cr-1',
    name: 'products',
    type: 'product',
    server_id: 'srv-1',
    extraction_config: { query: 'SELECT * FROM products' },
    property_mapping: {},
    last_sync_at: new Date('2026-01-01T00:00:00Z'),
  });

  crawler.connect = async () => { crawler.sqlClient = fakeInternalPool; };
  crawler.disconnect = async () => {};

  const indexed = [];
  crawler.indexDocument = async (doc) => indexed.push(doc);

  const result = await crawler.syncIncremental();
  assert.equal(result.fetched, 2);
  assert.equal(result.indexed, 1);
  assert.equal(result.skipped, 1);
});
