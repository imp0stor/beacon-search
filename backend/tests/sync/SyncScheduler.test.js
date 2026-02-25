const test = require('node:test');
const assert = require('node:assert');

const { SyncScheduler } = require('../../dist/sync/SyncScheduler');
const { SyncExecutor } = require('../../dist/sync/SyncExecutor');
const { ConnectorFactory } = require('../../dist/connectors/ConnectorFactory');

class FakePool {
  constructor(crawlers) {
    this.crawlers = crawlers;
  }

  async query(sql) {
    const q = sql.toLowerCase();
    if (q.includes('from crawlers')) {
      return { rows: this.crawlers };
    }
    throw new Error(`Unhandled query: ${sql}`);
  }
}

class E2EPool {
  constructor() {
    this.crawlers = [];
    this.servers = [{ id: 'server-1', type: 'postgresql' }];
    this.syncHistory = [];
  }

  async query(sql, params = []) {
    const q = sql.toLowerCase();

    if (q.startsWith('insert into crawlers')) {
      const row = { ...params[0] };
      this.crawlers.push(row);
      return { rows: [row] };
    }

    if (q.includes('from crawlers') && q.includes('where status =')) {
      return { rows: this.crawlers.filter((c) => c.status === 'active') };
    }

    if (q.includes('select * from crawlers where id = $1')) {
      return { rows: this.crawlers.filter((c) => c.id === params[0]) };
    }

    if (q.includes('select * from servers where id = $1')) {
      return { rows: this.servers.filter((s) => s.id === params[0]) };
    }

    if (q.startsWith('insert into sync_history')) {
      const row = { id: `hist-${this.syncHistory.length + 1}`, crawler_id: params[0], status: 'running' };
      this.syncHistory.push(row);
      return { rows: [row] };
    }

    if (q.startsWith('update sync_history')) return { rows: [] };
    if (q.startsWith('update crawlers')) return { rows: [] };
    if (q.startsWith('insert into system_alerts')) return { rows: [{ id: 'alert-1' }] };

    throw new Error(`Unhandled query: ${sql}`);
  }
}

test('SyncScheduler runs interval-based crawler automatically', async () => {
  const calls = [];
  const pool = new FakePool([
    {
      id: 'crawler-interval',
      name: 'Interval Crawler',
      status: 'active',
      schedule_type: 'interval',
      schedule_config: { seconds: 0.1 }
    }
  ]);

  const executor = {
    executeCrawler: async (id, reason) => {
      calls.push({ id, reason, at: Date.now() });
      return { status: 'success' };
    }
  };

  const scheduler = new SyncScheduler(pool, executor, 250);
  await scheduler.start();
  await new Promise((r) => setTimeout(r, 350));
  scheduler.stop();

  assert.ok(calls.length >= 2, `expected at least 2 scheduled calls, got ${calls.length}`);
  assert.equal(calls[0].id, 'crawler-interval');
  assert.equal(calls[0].reason, 'schedule');
});

test('SyncScheduler can run cron-based crawler', async () => {
  const calls = [];
  const pool = new FakePool([
    {
      id: 'crawler-cron',
      name: 'Cron Crawler',
      status: 'active',
      schedule_type: 'cron',
      schedule_config: { cron: '*/1 * * * * *' }
    }
  ]);

  const executor = {
    executeCrawler: async (id, reason) => {
      calls.push({ id, reason, at: Date.now() });
      return { status: 'success' };
    }
  };

  const scheduler = new SyncScheduler(pool, executor, 1000);
  await scheduler.start();
  await new Promise((r) => setTimeout(r, 1200));
  scheduler.stop();

  assert.ok(calls.length >= 1, 'expected at least one cron execution');
  assert.equal(calls[0].id, 'crawler-cron');
});

test('end-to-end: create crawler with schedule and auto-sync executes', async () => {
  const pool = new E2EPool();
  const originalCreate = ConnectorFactory.create;
  ConnectorFactory.create = () => ({
    syncIncremental: async () => ({ fetched: 3, indexed: 2, skipped: 1 }),
    syncFull: async () => ({ fetched: 3, indexed: 2, skipped: 1 })
  });

  try {
    const crawler = {
      id: 'crawler-e2e',
      name: 'E2E Crawler',
      type: 'product',
      server_id: 'server-1',
      status: 'active',
      schedule_type: 'interval',
      schedule_config: { seconds: 0.1 },
      extraction_config: { mode: 'incremental' },
      property_mapping: {},
      access_control: {},
      last_sync_at: null
    };

    await pool.query('INSERT INTO crawlers', [crawler]);

    const executor = new SyncExecutor(pool);
    const scheduler = new SyncScheduler(pool, executor, 200);
    await scheduler.start();
    await new Promise((r) => setTimeout(r, 350));
    scheduler.stop();

    assert.ok(pool.syncHistory.length >= 1, 'expected sync history entry from auto-sync');
  } finally {
    ConnectorFactory.create = originalCreate;
  }
});
