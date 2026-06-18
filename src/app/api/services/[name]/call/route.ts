import { NextRequest, NextResponse } from 'next/server';
import { registry } from '@/lib/circuit-breaker/CircuitBreakerRegistry';
import { CircuitOpenError } from '@/lib/circuit-breaker/CircuitBreaker';
import { callService } from '@/lib/services/MockService';

type RouteParams = { params: Promise<{ name: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  registry.ensureInitialized();
  const { name } = await params;
  const cb = registry.getByService(name);

  if (!cb) {
    return NextResponse.json({ error: `No circuit found for service '${name}'` }, { status: 404 });
  }

  try {
    const result = await cb.execute(() => callService(name));
    return NextResponse.json({ ok: true, ...result, state: cb.state, metrics: cb.metrics });
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      return NextResponse.json(
        { ok: false, error: err.message, reason: 'circuit_open', state: cb.state, metrics: cb.metrics },
        { status: 503 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: msg, reason: 'service_error', state: cb.state, metrics: cb.metrics },
      { status: 502 }
    );
  }
}
