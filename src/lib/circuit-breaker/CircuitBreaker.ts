import { EventEmitter } from 'events';
import { SlidingWindow } from './SlidingWindow';
import type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  CircuitEvent,
  CircuitState,
} from './types';
import { DEFAULT_CONFIG } from './types';

export class CircuitOpenError extends Error {
  constructor(public readonly circuitName: string) {
    super(`Circuit breaker '${circuitName}' is OPEN — call not permitted`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker extends EventEmitter {
  readonly id: string;
  readonly config: CircuitBreakerConfig;

  private _state: CircuitState = 'CLOSED';
  private _lastStateChangeAt: number = Date.now();
  private _openedAt: number | null = null;
  private _halfOpenCallCount: number = 0;
  private _totalCalls: number = 0;
  private _notPermittedCalls: number = 0;
  private readonly window: SlidingWindow;

  constructor(id: string, config: Partial<CircuitBreakerConfig> & { name: string; serviceName: string }) {
    super();
    this.id = id;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.window = new SlidingWindow(this.config.slidingWindowSize);
  }

  get state(): CircuitState {
    this.checkAutoTransitionToHalfOpen();
    return this._state;
  }

  get metrics(): CircuitBreakerMetrics {
    return {
      totalCalls: this._totalCalls,
      successfulCalls: this.window.successCount,
      failedCalls: this.window.failureCount,
      slowCalls: this.window.getSnapshot().filter(
        r => r.durationMs >= this.config.slowCallDurationThreshold
      ).length,
      notPermittedCalls: this._notPermittedCalls,
      failureRate: this.window.failureRate,
      slowCallRate: this.window.slowCallRateWithThreshold(this.config.slowCallDurationThreshold),
      avgDurationMs: this.window.avgDurationMs,
      state: this._state,
      lastStateChangeAt: this._lastStateChangeAt,
    };
  }

  get slidingWindowSnapshot() {
    return this.window.getSnapshot();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkAutoTransitionToHalfOpen();

    if (this._state === 'OPEN') {
      this._notPermittedCalls++;
      this._totalCalls++;
      this.emitEvent({ type: 'not_permitted' });
      throw new CircuitOpenError(this.config.name);
    }

    if (this._state === 'HALF_OPEN') {
      if (this._halfOpenCallCount >= this.config.permittedCallsInHalfOpen) {
        this._notPermittedCalls++;
        this._totalCalls++;
        this.emitEvent({ type: 'not_permitted' });
        throw new CircuitOpenError(this.config.name);
      }
      this._halfOpenCallCount++;
    }

    const start = Date.now();
    this._totalCalls++;

    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      this.onSuccess(durationMs);
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      this.onFailure(durationMs, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  private onSuccess(durationMs: number): void {
    const isSlow = durationMs >= this.config.slowCallDurationThreshold;
    this.window.record('success', durationMs);
    this.emitEvent({ type: isSlow ? 'slow_call' : 'success', durationMs });

    if (this._state === 'HALF_OPEN') {
      this.evaluateHalfOpen();
    } else {
      this.evaluateThresholds();
    }
  }

  private onFailure(durationMs: number, error: string): void {
    this.window.record('failure', durationMs);
    this.emitEvent({ type: 'failure', durationMs, error });

    if (this._state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN sends back to OPEN
      this.transitionTo('OPEN');
    } else {
      this.evaluateThresholds();
    }
  }

  private evaluateThresholds(): void {
    if (this.window.count < this.config.minimumNumberOfCalls) return;

    const failureRate = this.window.failureRate;
    const slowRate = this.window.slowCallRateWithThreshold(this.config.slowCallDurationThreshold);

    if (
      failureRate >= this.config.failureRateThreshold ||
      slowRate >= this.config.slowCallRateThreshold
    ) {
      this.transitionTo('OPEN');
    }
  }

  private evaluateHalfOpen(): void {
    if (this._halfOpenCallCount < this.config.permittedCallsInHalfOpen) return;
    // All permitted half-open calls succeeded → close
    if (this.window.failureRate === 0) {
      this.transitionTo('CLOSED');
    }
  }

  private checkAutoTransitionToHalfOpen(): void {
    if (
      this._state === 'OPEN' &&
      this._openedAt !== null &&
      Date.now() - this._openedAt >= this.config.waitDurationInOpenState
    ) {
      this.transitionTo('HALF_OPEN');
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this._state === newState) return;
    const fromState = this._state;
    this._state = newState;
    this._lastStateChangeAt = Date.now();

    if (newState === 'OPEN') {
      this._openedAt = Date.now();
      this._halfOpenCallCount = 0;
    } else if (newState === 'HALF_OPEN') {
      this._halfOpenCallCount = 0;
      this.window.reset();
    } else if (newState === 'CLOSED') {
      this._openedAt = null;
      this._halfOpenCallCount = 0;
      this.window.reset();
    }

    this.emitEvent({ type: 'state_change', fromState, toState: newState });
  }

  private emitEvent(partial: Partial<CircuitEvent> & { type: CircuitEvent['type'] }): void {
    const event: CircuitEvent = {
      circuitId: this.id,
      circuitName: this.config.name,
      timestamp: Date.now(),
      metrics: this.metrics,
      ...partial,
    };
    this.emit('event', event);
    this.emit(partial.type, event);
  }

  reset(): void {
    this._state = 'CLOSED';
    this._openedAt = null;
    this._halfOpenCallCount = 0;
    this._totalCalls = 0;
    this._notPermittedCalls = 0;
    this._lastStateChangeAt = Date.now();
    this.window.reset();
  }

  toJSON() {
    return {
      id: this.id,
      config: this.config,
      state: this.state,
      metrics: this.metrics,
    };
  }
}
