export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CallOutcome = 'success' | 'failure' | 'slow_success' | 'slow_failure' | 'not_permitted';

export interface CircuitBreakerConfig {
  name: string;
  serviceName: string;
  failureRateThreshold: number;        // percentage (0-100), default 50
  slowCallRateThreshold: number;       // percentage (0-100), default 100
  slowCallDurationThreshold: number;   // ms, default 2000
  waitDurationInOpenState: number;     // ms, default 10000
  permittedCallsInHalfOpen: number;    // default 5
  minimumNumberOfCalls: number;        // before evaluating thresholds, default 10
  slidingWindowSize: number;           // default 20
}

export interface CircuitBreakerMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  slowCalls: number;
  notPermittedCalls: number;
  failureRate: number;
  slowCallRate: number;
  avgDurationMs: number;
  state: CircuitState;
  lastStateChangeAt: number;
}

export interface CircuitEvent {
  circuitId: string;
  circuitName: string;
  type: 'state_change' | 'success' | 'failure' | 'slow_call' | 'not_permitted';
  fromState?: CircuitState;
  toState?: CircuitState;
  durationMs?: number;
  error?: string;
  timestamp: number;
  metrics?: CircuitBreakerMetrics;
}

export interface CallRecord {
  outcome: 'success' | 'failure';
  durationMs: number;
  timestamp: number;
}

export const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name' | 'serviceName'> = {
  failureRateThreshold: 50,
  slowCallRateThreshold: 100,
  slowCallDurationThreshold: 2000,
  waitDurationInOpenState: 10000,
  permittedCallsInHalfOpen: 5,
  minimumNumberOfCalls: 10,
  slidingWindowSize: 20,
};
