import { CircuitBreaker } from "./CircuitBreaker";
import type { CircuitBreakerConfig, CircuitEvent } from "./types";
import { DEFAULT_CONFIG } from "./types";
import { eventBus } from "../events/EventBus";
import { db } from "../db";

class CircuitBreakerRegistry {
  private circuits = new Map<string, CircuitBreaker>();

  initialize(): void {
    if (this.circuits.size > 0) return; // already initialized

    const defaults: Array<
      Partial<CircuitBreakerConfig> & { name: string; serviceName: string }
    > = [
      { name: "Payment Circuit", serviceName: "payment" },
      { name: "User Circuit", serviceName: "user" },
      { name: "Inventory Circuit", serviceName: "inventory" },
      {
        name: "Notification Circuit",
        serviceName: "notification",
        waitDurationInOpenState: 5000,
      },
      { name: "Order Circuit", serviceName: "order", failureRateThreshold: 30 },
    ];

    const existing = db.listCircuits();
    if (existing.length === 0) {
      for (const cfg of defaults) {
        const id = cfg.serviceName + "-circuit";
        const fullConfig: CircuitBreakerConfig = { ...DEFAULT_CONFIG, ...cfg };
        db.createCircuit({ id, config: fullConfig, currentState: "CLOSED" });
      }
    }

    for (const row of db.listCircuits()) {
      this.mount(row.id, row.config);
    }
  }

  ensureInitialized(): void {
    if (this.circuits.size === 0) this.initialize();
  }

  private mount(id: string, config: CircuitBreakerConfig): CircuitBreaker {
    const cb = new CircuitBreaker(id, config);
    cb.on("event", (event: CircuitEvent) => {
      // Persist to SQLite
      db.insertEvent(event);
      if (event.type === "state_change" && event.toState) {
        db.updateCircuitState(id, event.toState);
      }
      if (event.metrics) {
        db.insertMetricsSnapshot(id, event.metrics);
      }
      // Broadcast via EventBus (in-process or Redis)
      eventBus.publish(event);
    });
    this.circuits.set(id, cb);
    return cb;
  }

  get(id: string): CircuitBreaker | undefined {
    return this.circuits.get(id);
  }

  getByService(serviceName: string): CircuitBreaker | undefined {
    for (const cb of this.circuits.values()) {
      if (cb.config.serviceName === serviceName) return cb;
    }
    return undefined;
  }

  getAll(): CircuitBreaker[] {
    return Array.from(this.circuits.values());
  }

  create(id: string, config: CircuitBreakerConfig): CircuitBreaker {
    db.createCircuit({ id, config, currentState: "CLOSED" });
    return this.mount(id, config);
  }

  update(
    id: string,
    config: Partial<CircuitBreakerConfig>,
  ): CircuitBreaker | null {
    const existing = this.circuits.get(id);
    if (!existing) return null;
    const newConfig = { ...existing.config, ...config };
    db.updateCircuitConfig(id, newConfig);
    existing.reset();
    // Re-mount with new config
    this.circuits.delete(id);
    return this.mount(id, newConfig);
  }

  delete(id: string): boolean {
    if (!this.circuits.has(id)) return false;
    this.circuits.delete(id);
    db.deleteCircuit(id);
    return true;
  }
}

// Singleton — works in Next.js via global to survive HMR
const globalAny = global as unknown as {
  _circuitRegistry?: CircuitBreakerRegistry;
  _circuitRegistryReady?: boolean;
};
if (!globalAny._circuitRegistry) {
  globalAny._circuitRegistry = new CircuitBreakerRegistry();
}
export const registry = globalAny._circuitRegistry;

// Auto-initialize once, only at runtime (not during Next.js build-time static analysis)
if (!globalAny._circuitRegistryReady && process.env.NODE_ENV !== "test") {
  // Defer to microtask so module graph is fully resolved before touching SQLite
  Promise.resolve().then(() => {
    if (!globalAny._circuitRegistryReady) {
      globalAny._circuitRegistryReady = true;
      try {
        registry.initialize();
      } catch {
        /* DB not ready yet — first API call will retry */
      }
    }
  });
}
