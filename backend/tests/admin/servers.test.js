const test = require('node:test');
const assert = require('node:assert');

const { ServersController } = require('../../dist/controllers/ServersController');

class FakePool {
  constructor() {
    this.rows = [];
    this.seq = 1;
  }

  async query(sql, params = []) {
    const q = sql.toLowerCase();

    if (q.includes('select * from servers order by')) {
      return { rows: [...this.rows] };
    }

    if (q.includes('select * from servers where id = $1')) {
      const row = this.rows.find((r) => r.id === params[0]);
      return { rows: row ? [row] : [] };
    }

    if (q.startsWith('insert into servers')) {
      const row = {
        id: String(this.seq++),
        name: params[0],
        type: params[1],
        host: params[2],
        port: params[3],
        database_name: params[4],
        auth_type: params[5],
        auth_config: params[6],
        metadata: params[7],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.rows.push(row);
      return { rows: [row] };
    }

    if (q.startsWith('update servers')) {
      const id = params[8];
      const idx = this.rows.findIndex((r) => r.id === id);
      if (idx < 0) return { rows: [] };
      const updated = {
        ...this.rows[idx],
        name: params[0],
        type: params[1],
        host: params[2],
        port: params[3],
        database_name: params[4],
        auth_type: params[5],
        auth_config: params[6],
        metadata: params[7],
        updated_at: new Date().toISOString()
      };
      this.rows[idx] = updated;
      return { rows: [updated] };
    }

    if (q.startsWith('delete from servers where id = $1')) {
      const before = this.rows.length;
      this.rows = this.rows.filter((r) => r.id !== params[0]);
      return { rowCount: before - this.rows.length };
    }

    throw new Error(`Unhandled query in fake pool: ${sql}`);
  }
}

test('servers controller CRUD + validation + connection test', async () => {
  const pool = new FakePool();
  const controller = new ServersController(pool);

  assert.strictEqual(controller.validateCreate({}), 'name is required');
  assert.strictEqual(controller.validateCreate({ name: 'A' }), 'type is required');
  assert.strictEqual(controller.validateCreate({ name: 'A', type: 'postgres', host: 'bad host' }), 'host is invalid');

  const created = await controller.create({
    name: 'Primary',
    type: 'api',
    host: 'example.com',
    port: 5432,
    database_name: 'beacon',
    auth_type: 'password',
    auth_config: { user: 'u', password: 'p' }
  });
  assert.strictEqual(created.name, 'Primary');

  const list = await controller.list();
  assert.strictEqual(list.length, 1);

  const fetched = await controller.getById(created.id);
  assert.strictEqual(fetched.id, created.id);

  const updated = await controller.update(created.id, { name: 'Secondary', port: 6432 });
  assert.strictEqual(updated.name, 'Secondary');
  assert.strictEqual(updated.port, 6432);

  const testResult = await controller.testConnection(created.id);
  assert.strictEqual(testResult.success, true);
  assert.ok(typeof testResult.latency_ms === 'number');

  const removed = await controller.remove(created.id);
  assert.strictEqual(removed, true);
  assert.strictEqual((await controller.list()).length, 0);
});
