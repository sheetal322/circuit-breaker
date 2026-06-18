import { registry } from './CircuitBreakerRegistry';

// Called once at module load — safe to call multiple times (idempotent)
let initialized = false;
export function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  registry.initialize();
}
