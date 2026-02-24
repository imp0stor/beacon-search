import { ProviderHealth } from './types';

export class CircuitBreaker {
  private failureThreshold: number;
  private successThreshold: number;
  private resetTimeoutMs: number;
  private failures = 0;
  private successes = 0;
  private openedAt: number | null = null;
  private state: ProviderHealth['state'] = 'closed';

  constructor(options?: { failureThreshold?: number; successThreshold?: number; resetTimeoutMs?: number }) {
    this.failureThreshold = options?.failureThreshold ?? Number(process.env.FRPEI_BREAKER_FAILURE_THRESHOLD || 3);
    this.successThreshold = options?.successThreshold ?? Number(process.env.FRPEI_BREAKER_SUCCESS_THRESHOLD || 2);
    this.resetTimeoutMs = options?.resetTimeoutMs ?? Number(process.env.FRPEI_BREAKER_RESET_MS || 30_000);
  }

  canRequest(): boolean {
    if (this.state === 'open') {
      if (this.openedAt && Date.now() - this.openedAt > this.resetTimeoutMs) {
        this.state = 'half-open';
        this.failures = 0;
        this.successes = 0;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
        this.openedAt = null;
      }
      return;
    }
    this.failures = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }

  snapshot(): ProviderHealth {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : undefined
    };
  }
}
