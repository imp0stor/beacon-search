const test = require('node:test');
const assert = require('node:assert');

const { createUxRoutes } = require('../dist/routes/ux');

class MockPool {
  constructor(responses) {
    this.responses = responses;
    this.calls = [];
  }

  async query(sql, params = []) {
    this.calls.push({ sql, params });
    const next = this.responses.shift();
    return next || { rows: [] };
  }
}

function getRouteHandler(router, path) {
  const layer = router.stack.find((entry) => entry.route && entry.route.path === path);
  return layer.route.stack[0].handle;
}

function createRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

test('GET /search/filtered applies all requested filters and pagination', async () => {
  const pool = new MockPool([
    { rows: [{ id: 1, title: 'Doc', score: 0.9 }] },
    { rows: [{ total: 1 }] },
  ]);

  const router = createUxRoutes(pool, async () => [0.1, 0.2]);
  const handler = getRouteHandler(router, '/search/filtered');

  const req = {
    query: {
      q: 'nostr relay',
      mode: 'hybrid',
      tags: 'bitcoin,nostr',
      tagLogic: 'and',
      entityType: 'PERSON',
      entityValue: 'Satoshi',
      sentiment: 'positive',
      source: 'source-1',
      type: 'note',
      author: 'alice',
      wotMode: 'strict',
      wotThreshold: '0.7',
      limit: '10',
      offset: '20',
    },
  };

  const res = createRes();
  await handler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.limit, 10);
  assert.strictEqual(res.body.offset, 20);
  assert.strictEqual(res.body.total, 1);
  assert.strictEqual(res.body.filters.tagLogic, 'and');
  assert.strictEqual(res.body.filters.wotThreshold, 0.7);

  assert.strictEqual(pool.calls.length, 2);
  const searchSql = pool.calls[0].sql;
  assert.match(searchSql, /HAVING COUNT\(DISTINCT tag\) =/);
  assert.match(searchSql, /document_entities/);
  assert.match(searchSql, /document_metadata dm/);
  assert.match(searchSql, /meta_key IN \('wot_score', 'author_wot_score'\)/);
  assert.match(searchSql, /LIMIT \$\d+ OFFSET \$\d+/);
});

test('GET /tags/cooccurrence requires ALL selected tags (not ANY)', async () => {
  const pool = new MockPool([
    { rows: [{ doc_ids: [10, 11], doc_count: 2 }] },
    { rows: [{ tag: 'ai', count: 2, relatedness_score: 1 }] },
  ]);

  const router = createUxRoutes(pool);
  const handler = getRouteHandler(router, '/tags/cooccurrence');

  const req = { query: { selectedTags: 'nostr,bitcoin', limit: '5' } };
  const res = createRes();
  await handler(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.totalDocuments, 2);
  assert.strictEqual(res.body.relatedTags[0].tag, 'ai');

  const docsSql = pool.calls[0].sql;
  assert.match(docsSql, /HAVING COUNT\(DISTINCT tag\) = \$2/);
  assert.deepStrictEqual(pool.calls[0].params, [['nostr', 'bitcoin'], 2]);
});

test('GET /search/filtered supports OR tag logic query shape', async () => {
  const pool = new MockPool([
    { rows: [] },
    { rows: [{ total: 0 }] },
  ]);

  const router = createUxRoutes(pool);
  const handler = getRouteHandler(router, '/search/filtered');

  const req = { query: { tags: 'one,two', tagLogic: 'or', limit: '5', offset: '0' } };
  const res = createRes();
  await handler(req, res);

  assert.strictEqual(res.statusCode, 200);
  const searchSql = pool.calls[0].sql;
  assert.match(searchSql, /EXISTS \(/);
  assert.match(searchSql, /dt\.tag = ANY/);
});
