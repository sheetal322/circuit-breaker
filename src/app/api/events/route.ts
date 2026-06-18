import { NextRequest } from 'next/server';
import { eventBus } from '@/lib/events/EventBus';
import { registry } from '@/lib/circuit-breaker/CircuitBreakerRegistry';
import type { CircuitEvent } from '@/lib/circuit-breaker/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Ensure EventBus is initialized (Redis if available)
  await eventBus.init();

  const encoder = new TextEncoder();

  registry.ensureInitialized();
  const stream = new ReadableStream({
    async start(controller) {
      const signal = req.signal;

      // Send initial snapshot so the browser hydrates immediately
      const snapshot = registry.getAll().map(cb => ({
        type: 'snapshot' as const,
        circuitId: cb.id,
        circuitName: cb.config.name,
        timestamp: Date.now(),
        metrics: cb.metrics,
        state: cb.state,
      }));

      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller closed
        }
      };

      send({ type: 'connected', circuits: snapshot, timestamp: Date.now() });

      // Stream live events
      try {
        for await (const event of eventBus.stream(signal)) {
          if (signal.aborted) break;
          send(event as CircuitEvent);
        }
      } catch {
        // client disconnected
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
