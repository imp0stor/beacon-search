const test = require('node:test');
const assert = require('node:assert');

const { SyncExecutor } = require('../../dist/sync/SyncExecutor');
const { ConnectorFactory } = require('../../dist/connectors/ConnectorFactory');
const { NostrConnector } = require('../../dist/connectors/NostrConnector');

class FakePool {
  constructor({ crawler, server } = {}) {
    this.history = [];
    this.crawler = crawler || {
      id: 'crawler-1',
      name: 'Products Crawl',
      type: 'product',
      server_id: 'server-1',
      extraction_config: { mode: 'incremental' },
      property_mapping: {},
      access_control: {},
      last_sync_at: null
    };
    this.server = server || { id: 'server-1', type: 'postgresql' };
  }

  async query(sql, params = []) {
    const q = sql.toLowerCase();

    if (q.includes('select * from crawlers where id = $1')) return { rows: [this.crawler] };
    if (q.includes('select * from servers where id = $1')) return { rows: [this.server] };

    if (q.startsWith('insert into sync_history')) {
      const row = { id: 'hist-1', crawler_id: params[0], status: 'running' };
      this.history.push(row);
      return { rows: [row] };
    }

    if (q.startsWith('update sync_history')) return { rows: [] };
    if (q.startsWith('update crawlers')) return { rows: [] };
    if (q.startsWith('insert into system_alerts')) return { rows: [{ id: 'alert-1' }] };

    throw new Error(`Unhandled query: ${sql}`);
  }
}

test('SyncExecutor executes crawler sync and records success', async () => {
  const pool = new FakePool();
  const originalCreate = ConnectorFactory.create;
  ConnectorFactory.create = () => ({
    syncIncremental: async () => ({ fetched: 5, indexed: 4, skipped: 1 }),
    syncFull: async () => ({ fetched: 5, indexed: 4, skipped: 1 })
  });

  try {
    const executor = new SyncExecutor(pool);
    const result = await executor.executeCrawler('crawler-1', 'manual');
    assert.equal(result.status, 'success');
    assert.equal(result.fetched, 5);
    assert.equal(result.indexed, 4);
    assert.equal(result.skipped, 1);
  } finally {
    ConnectorFactory.create = originalCreate;
  }
});

test('SyncExecutor uses ConnectorFactory nostr path for nostr server', async () => {
  const pool = new FakePool({
    crawler: {
      id: 'crawler-nostr',
      name: 'Nostr Crawl',
      type: 'external',
      server_id: 'server-nostr',
      extraction_config: { mode: 'incremental', limit: 5 },
      property_mapping: {},
      access_control: {},
      last_sync_at: null
    },
    server: {
      id: 'server-nostr',
      type: 'nostr',
      metadata: { relays: ['wss://relay.damus.io'] }
    }
  });

  const originalSyncIncremental = NostrConnector.prototype.syncIncremental;
  NostrConnector.prototype.syncIncremental = async function () {
    return { fetched: 2, indexed: 2, skipped: 0 };
  };

  try {
    const executor = new SyncExecutor(pool);
    const result = await executor.executeCrawler('crawler-nostr', 'manual');
    assert.equal(result.status, 'success');
    assert.equal(result.fetched, 2);
    assert.equal(result.indexed, 2);
    assert.equal(result.skipped, 0);
  } finally {
    NostrConnector.prototype.syncIncremental = originalSyncIncremental;
  }
});

test('SyncExecutor creates alert on failure', async () => {
  const pool = new FakePool();
  let alertInserted = false;
  const originalQuery = pool.query.bind(pool);
  pool.query = async (sql, params = []) => {
    if (sql.toLowerCase().startsWith('insert into system_alerts')) {
      alertInserted = true;
    }
    return originalQuery(sql, params);
  };

  const originalCreate = ConnectorFactory.create;
  ConnectorFactory.create = () => ({
    syncIncremental: async () => { throw new Error('DB timeout'); },
    syncFull: async () => { throw new Error('DB timeout'); }
  });

  try {
    const executor = new SyncExecutor(pool);
    await assert.rejects(() => executor.executeCrawler('crawler-1', 'manual'), /DB timeout/);
    assert.equal(alertInserted, true);
  } finally {
    ConnectorFactory.create = originalCreate;
  }
});
