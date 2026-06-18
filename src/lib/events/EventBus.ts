import { EventEmitter } from 'events';
import type { CircuitEvent } from '../circuit-breaker/types';

// Abstraction that works in-process (dev) or via Redis (prod).
// Set REDIS_URL env var to enable Redis pub/sub.
const CHANNEL = 'circuit:events';

type Listener = (event: CircuitEvent) => void;

class EventBus {
  private emitter = new EventEmitter();
  private redisPublisher: import('ioredis').Redis | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (!process.env.REDIS_URL) return;

    try {
      const { default: Redis } = await import('ioredis');
      this.redisPublisher = new Redis(process.env.REDIS_URL, { lazyConnect: true });
      await this.redisPublisher.connect();
    } catch {
      console.warn('[EventBus] Redis unavailable, falling back to in-process EventEmitter');
      this.redisPublisher = null;
    }
  }

  publish(event: CircuitEvent): void {
    // Always emit in-process so same-process SSE subscribers get it immediately
    this.emitter.emit(CHANNEL, event);

    // Also publish to Redis if available (for multi-process scenarios)
    if (this.redisPublisher) {
      this.redisPublisher.publish(CHANNEL, JSON.stringify(event)).catch(() => {});
    }
  }

  subscribe(listener: Listener): () => void {
    this.emitter.on(CHANNEL, listener);
    return () => this.emitter.off(CHANNEL, listener);
  }

  // For SSE endpoint: returns an async iterable that yields events
  async *stream(signal: AbortSignal): AsyncGenerator<CircuitEvent> {
    const queue: CircuitEvent[] = [];
    let resolve: (() => void) | null = null;

    const onEvent = (event: CircuitEvent) => {
      queue.push(event);
      resolve?.();
      resolve = null;
    };

    const unsubscribe = this.subscribe(onEvent);

    signal.addEventListener('abort', () => {
      unsubscribe();
      resolve?.();
    });

    try {
      while (!signal.aborted) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>(r => { resolve = r; });
        }
      }
    } finally {
      unsubscribe();
    }
  }
}

// Global singleton survives Next.js HMR
const g = global as unknown as { _eventBus?: EventBus };
if (!g._eventBus) g._eventBus = new EventBus();
export const eventBus = g._eventBus;
