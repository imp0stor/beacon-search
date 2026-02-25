import { Pool } from "pg";

export class DashboardController {
  constructor(private readonly pool: Pool) {}

  async alerts(acknowledged?: boolean, limit = 100) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100;

    if (typeof acknowledged === "boolean") {
      const result = await this.pool.query(
        "SELECT * FROM system_alerts WHERE acknowledged = $1 ORDER BY created_at DESC LIMIT $2",
        [acknowledged, safeLimit]
      );
      return result.rows;
    }

    const result = await this.pool.query(
      "SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT $1",
      [safeLimit]
    );
    return result.rows;
  }

  async acknowledgeAlert(id: string, acknowledgedBy: string, acknowledged = true) {
    const result = await this.pool.query(
      "UPDATE system_alerts SET acknowledged = $1, acknowledged_by = $2, acknowledged_at = CASE WHEN $1 THEN NOW() ELSE NULL END WHERE id = $3 RETURNING *",
      [acknowledged, acknowledgedBy, id]
    );

    return result.rows[0] ?? null;
  }

  async indexStatus() {
    const [docCount, crawlerCounts, syncSummary, unackAlerts, docsByType] = await Promise.all([
      this.pool.query("SELECT COUNT(*)::int AS total FROM documents"),
      this.pool.query(
        "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'active')::int AS active, COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive, COUNT(*) FILTER (WHERE status = 'error')::int AS error FROM crawlers"
      ),
      this.pool.query(
        "SELECT COUNT(*)::int AS total_runs, COUNT(*) FILTER (WHERE status = 'running')::int AS running, COUNT(*) FILTER (WHERE status = 'success')::int AS success, COUNT(*) FILTER (WHERE status = 'failed')::int AS failed, MAX(started_at) AS last_sync_at FROM sync_history"
      ),
      this.pool.query("SELECT COUNT(*)::int AS total FROM system_alerts WHERE acknowledged = false"),
      this.pool.query(
        "SELECT COALESCE(document_type, 'unknown') AS type, COUNT(*)::int AS count FROM documents GROUP BY COALESCE(document_type, 'unknown') ORDER BY COUNT(*) DESC LIMIT 20"
      )
    ]);

    return {
      documents: docCount.rows[0]?.total ?? 0,
      documents_by_type: docsByType.rows ?? [],
      crawlers: crawlerCounts.rows[0] ?? { total: 0, active: 0, inactive: 0, error: 0 },
      sync: syncSummary.rows[0] ?? { total_runs: 0, running: 0, success: 0, failed: 0, last_sync_at: null },
      unacknowledged_alerts: unackAlerts.rows[0]?.total ?? 0
    };
  }

  async syncHistory(limit = 100, status?: string) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100;

    if (status) {
      const result = await this.pool.query(
        "SELECT sh.*, c.name AS crawler_name FROM sync_history sh LEFT JOIN crawlers c ON c.id = sh.crawler_id WHERE sh.status = $1 ORDER BY sh.started_at DESC LIMIT $2",
        [status, safeLimit]
      );
      return result.rows;
    }

    const result = await this.pool.query(
      "SELECT sh.*, c.name AS crawler_name FROM sync_history sh LEFT JOIN crawlers c ON c.id = sh.crawler_id ORDER BY sh.started_at DESC LIMIT $1",
      [safeLimit]
    );
    return result.rows;
  }
}
