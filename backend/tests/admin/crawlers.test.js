const test = require('node:test');
const assert = require('node:assert');

const { CrawlersController } = require('../../dist/controllers/CrawlersController');

class FakePool {
  constructor() {
    this.crawlers = [];
    this.syncHistory = [];
    this.documents = [];
    this.seq = 1;
    this.syncSeq = 1;
  }

  async query(sql, params = []) {
    const q = sql.toLowerCase().trim();

    if (q.includes('select * from crawlers order by')) return { rows: [...this.crawlers] };
    if (q.includes('select * from crawlers where id = $1')) {
      const row = this.crawlers.find((c) => c.id === params[0]);
      return { rows: row ? [row] : [] };
    }

    if (q.startsWith('insert into crawlers')) {
      const row = {
        id: String(this.seq++),
        name: params[0],
        type: params[1],
        server_id: params[2],
        document_type_id: params[3],
        status: params[4],
        schedule_type: params[5],
        schedule_config: params[6],
        extraction_config: params[7],
        property_mapping: params[8],
        access_control: params[9],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_sync_at: null,
        last_sync_status: null,
        last_sync_error: null
      };
      this.crawlers.push(row);
      return { rows: [row] };
    }

    if (q.startsWith('update crawlers') && q.includes('set name = $1')) {
      const id = params[10];
      const idx = this.crawlers.findIndex((c) => c.id === id);
      if (idx < 0) return { rows: [] };
      const updated = {
        ...this.crawlers[idx],
        name: params[0],
        type: params[1],
        server_id: params[2],
        document_type_id: params[3],
        status: params[4],
        schedule_type: params[5],
        schedule_config: params[6],
        extraction_config: params[7],
        property_mapping: params[8],
        access_control: params[9],
        updated_at: new Date().toISOString()
      };
      this.crawlers[idx] = updated;
      return { rows: [updated] };
    }

    if (q.startsWith('delete from crawlers where id = $1')) {
      const before = this.crawlers.length;
      this.crawlers = this.crawlers.filter((c) => c.id !== params[0]);
      return { rowCount: before - this.crawlers.length };
    }

    if (q.startsWith('insert into sync_history')) {
      const row = {
        id: `h${this.syncSeq++}`,
        crawler_id: params[0],
        started_at: new Date().toISOString(),
        completed_at: null,
        status: 'running',
        metadata: params[1],
        documents_added: 0,
        documents_updated: 0,
        documents_deleted: 0,
        error_message: null
      };
      this.syncHistory.unshift(row);
      return { rows: [row] };
    }

    if (q.startsWith('update crawlers') && q.includes("last_sync_status = 'running'")) {
      const id = params[0];
      const idx = this.crawlers.findIndex((c) => c.id === id);
      if (idx >= 0) {
        this.crawlers[idx] = {
          ...this.crawlers[idx],
          last_sync_status: 'running',
          last_sync_at: new Date().toISOString(),
          last_sync_error: null,
          updated_at: new Date().toISOString()
        };
      }
      return { rows: [] };
    }

    if (q.startsWith('delete from documents where source_id = $1')) {
      const before = this.documents.length;
      this.documents = this.documents.filter((d) => d.source_id !== params[0]);
      return { rowCount: before - this.documents.length };
    }

    if (q.includes('from sync_history') && q.includes('where crawler_id = $1')) {
      const rows = this.syncHistory.filter((h) => h.crawler_id === params[0]).slice(0, params[1]);
      return { rows };
    }

    throw new Error(`Unhandled query in fake pool: ${sql}`);
  }
}

test('crawlers controller CRUD + sync trigger + delete docs + history', async () => {
  const pool = new FakePool();
  const controller = new CrawlersController(pool);

  assert.strictEqual(controller.validateCreate({}), 'name is required');
  assert.strictEqual(
    controller.validateCreate({ name: 'x', type: 'weird', extraction_config: {} }),
    'type must be one of: product, external, manual'
  );

  const created = await controller.create({
    name: 'Crawler A',
    type: 'manual',
    extraction_config: { query: 'SELECT 1' },
    status: 'inactive'
  });
  assert.strictEqual(created.name, 'Crawler A');

  pool.documents.push({ id: 'd1', source_id: created.id }, { id: 'd2', source_id: created.id }, { id: 'd3', source_id: 'other' });

  const listed = await controller.list();
  assert.strictEqual(listed.length, 1);

  const updated = await controller.update(created.id, { status: 'active' });
  assert.strictEqual(updated.status, 'active');

  const sync = await controller.triggerSync(created.id);
  assert.strictEqual(sync.crawler_id, created.id);
  assert.strictEqual(sync.sync.status, 'running');

  const history = await controller.history(created.id, 10);
  assert.strictEqual(history.length, 1);

  const deletedDocs = await controller.deleteDocuments(created.id);
  assert.strictEqual(deletedDocs.deleted, 2);

  const removed = await controller.remove(created.id);
  assert.strictEqual(removed, true);
});
