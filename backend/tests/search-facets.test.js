const test = require('node:test');
const assert = require('node:assert');

const { getSearchFacets } = require('../dist/search/facets');

class MockPool {
  constructor(responses) {
    this.responses = responses;
    this.calls = [];
  }

  async query(sql) {
    this.calls.push(sql);
    const next = this.responses.shift();
    return next || { rows: [] };
  }
}

test('getSearchFacets returns aggregated facets for search UI', async () => {
  const pool = new MockPool([
    { rows: [{ value: 'nostr', count: 12 }] },
    { rows: [{ value: 'alice', count: 9 }] },
    { rows: [{ value: 'note', count: 15 }] },
    { rows: [{ value: 'article', count: 7 }] },
    { rows: [{ sentiment: 'positive', count: 4 }] },
    {
      rows: [
        { entity_type: 'PERSON', value: 'Satoshi', count: 3 },
        { entity_type: 'ORGANIZATION', value: 'OpenAI', count: 2 },
      ],
    },
    { rows: [{ last_24h: 1, last_7d: 3, last_30d: 8, last_90d: 10, all_time: 20 }] },
    { rows: [{ documents: 20, tagged_documents: 14, nostr_documents: 11 }] },
  ]);

  const facets = await getSearchFacets(pool);

  assert.deepStrictEqual(facets.tags, [{ value: 'nostr', count: 12 }]);
  assert.deepStrictEqual(facets.authors, [{ value: 'alice', count: 9 }]);
  assert.deepStrictEqual(facets.contentTypes, [{ value: 'note', count: 15 }]);
  assert.deepStrictEqual(facets.documentTypes, [{ value: 'article', count: 7 }]);
  assert.deepStrictEqual(facets.sentiment, [{ sentiment: 'positive', value: 'positive', count: 4 }]);
  assert.deepStrictEqual(facets.entityTypes.PERSON, [{ value: 'Satoshi', count: 3 }]);
  assert.deepStrictEqual(facets.entityTypes.ORGANIZATION, [{ value: 'OpenAI', count: 2 }]);
  assert.strictEqual(facets.dateRanges.find((r) => r.range === '30d').count, 8);
  assert.deepStrictEqual(facets.totals, {
    documents: 20,
    taggedDocuments: 14,
    nostrDocuments: 11,
  });
  assert.strictEqual(pool.calls.length, 8);
});
