import Database from 'better-sqlite3';
import path from 'path';
import type { CircuitBreakerConfig, CircuitBreakerMetrics, CircuitEvent, CircuitState } from '../circuit-breaker/types';

const DB_PATH = path.join(process.cwd(), 'circuit-breaker.db');

function createDb() {
  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS circuits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      service_name TEXT NOT NULL,
      config TEXT NOT NULL,
      current_state TEXT NOT NULL DEFAULT 'CLOSED',
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circuit_id TEXT NOT NULL,
      circuit_name TEXT NOT NULL,
      type TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT,
      duration_ms INTEGER,
      error TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_circuit_id ON events(circuit_id);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);

    CREATE TABLE IF NOT EXISTS metrics_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      circuit_id TEXT NOT NULL,
      failure_rate REAL,
      slow_call_rate REAL,
      total_calls INTEGER,
      successful_calls INTEGER,
      failed_calls INTEGER,
      avg_duration_ms REAL,
      state TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_circuit_ts ON metrics_snapshots(circuit_id, timestamp DESC);
  `);

  return database;
}

const g = global as unknown as { _db?: ReturnType<typeof createDb> };

// Lazy getter — only opens the DB file when a query is actually executed (not at build time)
function getDb() {
  if (!g._db) g._db = createDb();
  return g._db;
}

export const db = {
  listCircuits(): Array<{ id: string; config: CircuitBreakerConfig; currentState: CircuitState }> {
    const database = getDb();
    const rows = database.prepare('SELECT id, config, current_state FROM circuits').all() as Array<{
      id: string; config: string; current_state: string;
    }>;
    return rows.map(r => ({
      id: r.id,
      config: JSON.parse(r.config) as CircuitBreakerConfig,
      currentState: r.current_state as CircuitState,
    }));
  },

  getCircuit(id: string): { id: string; config: CircuitBreakerConfig; currentState: CircuitState } | null {
    const db = getDb();
    const row = db.prepare('SELECT id, config, current_state FROM circuits WHERE id = ?').get(id) as
      | { id: string; config: string; current_state: string } | undefined;
    if (!row) return null;
    return { id: row.id, config: JSON.parse(row.config) as CircuitBreakerConfig, currentState: row.current_state as CircuitState };
  },

  createCircuit(data: { id: string; config: CircuitBreakerConfig; currentState: CircuitState }): void {
    getDb().prepare(
      'INSERT OR IGNORE INTO circuits (id, name, service_name, config, current_state) VALUES (?, ?, ?, ?, ?)'
    ).run(data.id, data.config.name, data.config.serviceName, JSON.stringify(data.config), data.currentState);
  },

  updateCircuitConfig(id: string, config: CircuitBreakerConfig): void {
    getDb().prepare('UPDATE circuits SET config = ?, name = ?, service_name = ? WHERE id = ?')
      .run(JSON.stringify(config), config.name, config.serviceName, id);
  },

  updateCircuitState(id: string, state: CircuitState): void {
    getDb().prepare('UPDATE circuits SET current_state = ? WHERE id = ?').run(state, id);
  },

  deleteCircuit(id: string): void {
    getDb().prepare('DELETE FROM circuits WHERE id = ?').run(id);
  },

  insertEvent(event: CircuitEvent): void {
    getDb().prepare(
      `INSERT INTO events (circuit_id, circuit_name, type, from_state, to_state, duration_ms, error, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      event.circuitId, event.circuitName, event.type,
      event.fromState ?? null, event.toState ?? null,
      event.durationMs ?? null, event.error ?? null,
      event.timestamp
    );
  },

  getEvents(circuitId: string, limit = 100): CircuitEvent[] {
    const rows = getDb().prepare(
      'SELECT * FROM events WHERE circuit_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(circuitId, limit) as Array<{
      id: number; circuit_id: string; circuit_name: string; type: string;
      from_state: string | null; to_state: string | null; duration_ms: number | null;
      error: string | null; timestamp: number;
    }>;
    return rows.map(r => ({
      circuitId: r.circuit_id,
      circuitName: r.circuit_name,
      type: r.type as CircuitEvent['type'],
      fromState: r.from_state as CircuitState | undefined,
      toState: r.to_state as CircuitState | undefined,
      durationMs: r.duration_ms ?? undefined,
      error: r.error ?? undefined,
      timestamp: r.timestamp,
    }));
  },

  getAllRecentEvents(limit = 50): CircuitEvent[] {
    const rows = getDb().prepare(
      'SELECT * FROM events ORDER BY timestamp DESC LIMIT ?'
    ).all(limit) as Array<{
      id: number; circuit_id: string; circuit_name: string; type: string;
      from_state: string | null; to_state: string | null; duration_ms: number | null;
      error: string | null; timestamp: number;
    }>;
    return rows.map(r => ({
      circuitId: r.circuit_id,
      circuitName: r.circuit_name,
      type: r.type as CircuitEvent['type'],
      fromState: r.from_state as CircuitState | undefined,
      toState: r.to_state as CircuitState | undefined,
      durationMs: r.duration_ms ?? undefined,
      error: r.error ?? undefined,
      timestamp: r.timestamp,
    }));
  },

  insertMetricsSnapshot(circuitId: string, metrics: CircuitBreakerMetrics): void {
    const database = getDb();
    // Throttle: only insert every 2 seconds per circuit
    const last = database.prepare(
      'SELECT timestamp FROM metrics_snapshots WHERE circuit_id = ? ORDER BY timestamp DESC LIMIT 1'
    ).get(circuitId) as { timestamp: number } | undefined;
    if (last && Date.now() - last.timestamp < 2000) return;

    database.prepare(
      `INSERT INTO metrics_snapshots (circuit_id, failure_rate, slow_call_rate, total_calls, successful_calls, failed_calls, avg_duration_ms, state, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      circuitId, metrics.failureRate, metrics.slowCallRate, metrics.totalCalls,
      metrics.successfulCalls, metrics.failedCalls, metrics.avgDurationMs,
      metrics.state, Date.now()
    );
  },

  getMetricsHistory(circuitId: string, sinceMs = 5 * 60 * 1000): Array<CircuitBreakerMetrics & { timestamp: number }> {
    const since = Date.now() - sinceMs;
    const rows = getDb().prepare(
      'SELECT * FROM metrics_snapshots WHERE circuit_id = ? AND timestamp > ? ORDER BY timestamp ASC'
    ).all(circuitId, since) as Array<{
      failure_rate: number; slow_call_rate: number; total_calls: number;
      successful_calls: number; failed_calls: number; avg_duration_ms: number;
      state: string; timestamp: number;
    }>;
    return rows.map(r => ({
      failureRate: r.failure_rate,
      slowCallRate: r.slow_call_rate,
      totalCalls: r.total_calls,
      successfulCalls: r.successful_calls,
      failedCalls: r.failed_calls,
      avgDurationMs: r.avg_duration_ms,
      state: r.state as CircuitState,
      notPermittedCalls: 0,
      slowCalls: 0,
      lastStateChangeAt: r.timestamp,
      timestamp: r.timestamp,
    }));
  },
};
