import type { CallRecord } from './types';

export class SlidingWindow {
  private records: CallRecord[] = [];
  private readonly size: number;

  constructor(size: number) {
    this.size = size;
  }

  record(outcome: 'success' | 'failure', durationMs: number): void {
    this.records.push({ outcome, durationMs, timestamp: Date.now() });
    if (this.records.length > this.size) {
      this.records.shift();
    }
  }

  get count(): number {
    return this.records.length;
  }

  get failureRate(): number {
    if (this.records.length === 0) return 0;
    const failures = this.records.filter(r => r.outcome === 'failure').length;
    return (failures / this.records.length) * 100;
  }

  get slowCallRate(): number {
    return 0; // computed by CircuitBreaker with threshold context
  }

  slowCallRateWithThreshold(thresholdMs: number): number {
    if (this.records.length === 0) return 0;
    const slow = this.records.filter(r => r.durationMs >= thresholdMs).length;
    return (slow / this.records.length) * 100;
  }

  get avgDurationMs(): number {
    if (this.records.length === 0) return 0;
    return this.records.reduce((sum, r) => sum + r.durationMs, 0) / this.records.length;
  }

  get successCount(): number {
    return this.records.filter(r => r.outcome === 'success').length;
  }

  get failureCount(): number {
    return this.records.filter(r => r.outcome === 'failure').length;
  }

  getSnapshot(): CallRecord[] {
    return [...this.records];
  }

  reset(): void {
    this.records = [];
  }
}
