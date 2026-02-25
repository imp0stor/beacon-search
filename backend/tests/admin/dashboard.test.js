const test = require("node:test");
const assert = require("node:assert");

const { DashboardController } = require("../../dist/controllers/DashboardController");

class FakePool {
  constructor() {
    this.documents = [{ id: "d1" }, { id: "d2" }, { id: "d3" }];
    this.crawlers = [
      { id: "c1", name: "Crawler 1", status: "active" },
      { id: "c2", name: "Crawler 2", status: "inactive" },
      { id: "c3", name: "Crawler 3", status: "error" }
    ];
    this.syncHistory = [
      { id: "s1", crawler_id: "c1", status: "success", started_at: "2026-02-24T00:00:00.000Z" },
      { id: "s2", crawler_id: "c2", status: "failed", started_at: "2026-02-24T01:00:00.000Z" }
    ];
    this.alerts = [
      { id: "a1", message: "sync failed", acknowledged: false, created_at: "2026-02-24T01:30:00.000Z", acknowledged_by: null, acknowledged_at: null },
      { id: "a2", message: "index warning", acknowledged: true, created_at: "2026-02-23T01:30:00.000Z", acknowledged_by: "ops", acknowledged_at: "2026-02-23T02:00:00.000Z" }
    ];
  }

  async query(sql, params = []) {
    const q = sql.toLowerCase().trim();

    if (q.includes("select * from system_alerts") && q.includes("where acknowledged = $1")) {
      return { rows: this.alerts.filter((a) => a.acknowledged === params[0]).slice(0, params[1]) };
    }

    if (q.startsWith("select * from system_alerts")) {
      return { rows: this.alerts.slice(0, params[0]) };
    }

    if (q.startsWith("update system_alerts")) {
      const idx = this.alerts.findIndex((a) => a.id === params[2]);
      if (idx < 0) return { rows: [] };
      this.alerts[idx] = {
        ...this.alerts[idx],
        acknowledged: params[0],
        acknowledged_by: params[1],
        acknowledged_at: params[0] ? new Date().toISOString() : null
      };
      return { rows: [this.alerts[idx]] };
    }

    if (q === "select count(*)::int as total from documents") {
      return { rows: [{ total: this.documents.length }] };
    }

    if (q.includes("count(*)::int as total") && q.includes("from crawlers")) {
      const counts = {
        total: this.crawlers.length,
        active: this.crawlers.filter((c) => c.status === "active").length,
        inactive: this.crawlers.filter((c) => c.status === "inactive").length,
        error: this.crawlers.filter((c) => c.status === "error").length
      };
      return { rows: [counts] };
    }

    if (q.includes("count(*)::int as total_runs") && q.includes("from sync_history")) {
      return {
        rows: [{
          total_runs: this.syncHistory.length,
          running: this.syncHistory.filter((s) => s.status === "running").length,
          success: this.syncHistory.filter((s) => s.status === "success").length,
          failed: this.syncHistory.filter((s) => s.status === "failed").length,
          last_sync_at: this.syncHistory[1].started_at
        }]
      };
    }

    if (q.startsWith("select count(*)::int as total from system_alerts where acknowledged = false")) {
      return { rows: [{ total: this.alerts.filter((a) => !a.acknowledged).length }] };
    }

    if (q.startsWith("select coalesce(document_type, 'unknown') as type, count(*)::int as count from documents")) {
      return { rows: [{ type: "unknown", count: this.documents.length }] };
    }

    if (q.startsWith("select sh.*, c.name as crawler_name") && q.includes("where sh.status = $1")) {
      const rows = this.syncHistory
        .filter((s) => s.status === params[0])
        .map((s) => ({ ...s, crawler_name: this.crawlers.find((c) => c.id === s.crawler_id)?.name || null }))
        .slice(0, params[1]);
      return { rows };
    }

    if (q.startsWith("select sh.*, c.name as crawler_name")) {
      const rows = this.syncHistory
        .map((s) => ({ ...s, crawler_name: this.crawlers.find((c) => c.id === s.crawler_id)?.name || null }))
        .slice(0, params[0]);
      return { rows };
    }

    throw new Error(`Unhandled query in fake pool: ${sql}`);
  }
}

test("dashboard controller alerts, ack, index status, sync history", async () => {
  const pool = new FakePool();
  const controller = new DashboardController(pool);

  const allAlerts = await controller.alerts(undefined, 10);
  assert.strictEqual(allAlerts.length, 2);

  const unacked = await controller.alerts(false, 10);
  assert.strictEqual(unacked.length, 1);

  const acked = await controller.acknowledgeAlert("a1", "adam");
  assert.strictEqual(acked.acknowledged, true);
  assert.strictEqual(acked.acknowledged_by, "adam");

  const status = await controller.indexStatus();
  assert.strictEqual(status.documents, 3);
  assert.strictEqual(status.crawlers.total, 3);
  assert.strictEqual(status.sync.total_runs, 2);
  assert.strictEqual(status.documents_by_type[0].count, 3);

  const allHistory = await controller.syncHistory(10);
  assert.strictEqual(allHistory.length, 2);

  const failedHistory = await controller.syncHistory(10, "failed");
  assert.strictEqual(failedHistory.length, 1);
});
