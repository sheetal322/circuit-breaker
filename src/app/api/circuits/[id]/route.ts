import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registry } from '@/lib/circuit-breaker/CircuitBreakerRegistry';
import { db } from '@/lib/db';

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  failureRateThreshold: z.number().min(1).max(100).optional(),
  slowCallRateThreshold: z.number().min(1).max(100).optional(),
  slowCallDurationThreshold: z.number().min(100).optional(),
  waitDurationInOpenState: z.number().min(1000).optional(),
  permittedCallsInHalfOpen: z.number().min(1).optional(),
  minimumNumberOfCalls: z.number().min(1).optional(),
  slidingWindowSize: z.number().min(5).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  registry.ensureInitialized();
  const { id } = await params;
  const cb = registry.get(id);
  if (!cb) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const events = db.getEvents(id, 100);
  const history = db.getMetricsHistory(id);

  return NextResponse.json({
    ...cb.toJSON(),
    slidingWindow: cb.slidingWindowSnapshot,
    events,
    history,
  });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = registry.update(id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(updated.toJSON());
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const deleted = registry.delete(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
