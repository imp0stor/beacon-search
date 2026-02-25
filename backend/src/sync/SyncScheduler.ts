import cron, { ScheduledTask } from 'node-cron';
import { Pool } from 'pg';
import { SyncExecutor } from './SyncExecutor';

interface CrawlerScheduleRow {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  schedule_type: 'cron' | 'interval' | 'manual' | null;
  schedule_config: Record<string, any> | null;
}

export class SyncScheduler {
  private cronTasks = new Map<string, ScheduledTask>();
  private intervalTasks = new Map<string, NodeJS.Timeout>();
  private refreshInterval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly pool: Pool,
    private readonly executor: SyncExecutor,
    private readonly refreshMs: number = 30_000
  ) {}

  async start() {
    if (this.running) return;
    this.running = true;
    await this.refreshSchedules();
    this.refreshInterval = setInterval(() => {
      this.refreshSchedules().catch((err) => {
        console.error('[sync-scheduler] refresh failed:', err);
      });
    }, this.refreshMs);
    console.log('[sync-scheduler] started');
  }

  stop() {
    if (!this.running) return;
    this.running = false;

    for (const task of this.cronTasks.values()) task.stop();
    for (const task of this.cronTasks.values()) task.destroy();
    for (const timer of this.intervalTasks.values()) clearInterval(timer);

    this.cronTasks.clear();
    this.intervalTasks.clear();

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    console.log('[sync-scheduler] stopped');
  }

  async refreshSchedules() {
    const result = await this.pool.query(
      `SELECT id, name, status, schedule_type, schedule_config
       FROM crawlers
       WHERE status = 'active'
         AND schedule_type IN ('cron', 'interval')`
    );

    const crawlers = result.rows as CrawlerScheduleRow[];
    const activeIds = new Set(crawlers.map((c) => c.id));

    for (const [crawlerId, task] of this.cronTasks.entries()) {
      if (!activeIds.has(crawlerId)) {
        task.stop();
        task.destroy();
        this.cronTasks.delete(crawlerId);
      }
    }

    for (const [crawlerId, timer] of this.intervalTasks.entries()) {
      if (!activeIds.has(crawlerId)) {
        clearInterval(timer);
        this.intervalTasks.delete(crawlerId);
      }
    }

    for (const crawler of crawlers) {
      this.ensureScheduled(crawler);
    }
  }

  private ensureScheduled(crawler: CrawlerScheduleRow) {
    if (crawler.schedule_type === 'cron') {
      const expression = String(crawler.schedule_config?.cron || '').trim();
      if (!expression || !cron.validate(expression)) {
        console.warn(`[sync-scheduler] invalid cron for crawler ${crawler.name}:`, expression);
        return;
      }

      if (this.cronTasks.has(crawler.id)) return;

      const task = cron.schedule(expression, () => {
        this.executor.executeCrawler(crawler.id, 'schedule').catch((err) => {
          console.error(`[sync-scheduler] sync failed for ${crawler.name}:`, err);
        });
      });
      this.cronTasks.set(crawler.id, task);
      return;
    }

    if (crawler.schedule_type === 'interval') {
      const seconds = Number(crawler.schedule_config?.seconds || crawler.schedule_config?.interval_seconds || 0);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        console.warn(`[sync-scheduler] invalid interval for crawler ${crawler.name}:`, seconds);
        return;
      }

      if (this.intervalTasks.has(crawler.id)) return;

      const timer = setInterval(() => {
        this.executor.executeCrawler(crawler.id, 'schedule').catch((err) => {
          console.error(`[sync-scheduler] sync failed for ${crawler.name}:`, err);
        });
      }, seconds * 1000);
      this.intervalTasks.set(crawler.id, timer);
    }
  }
}
