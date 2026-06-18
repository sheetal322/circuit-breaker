import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registry } from '@/lib/circuit-breaker/CircuitBreakerRegistry';
import { DEFAULT_CONFIG } from '@/lib/circuit-breaker/types';

const CreateSchema = z.object({
  name: z.string().min(1),
  serviceName: z.string().min(1),
  failureRateThreshold: z.number().min(1).max(100).optional(),
  slowCallRateThreshold: z.number().min(1).max(100).optional(),
  slowCallDurationThreshold: z.number().min(100).optional(),
  waitDurationInOpenState: z.number().min(1000).optional(),
  permittedCallsInHalfOpen: z.number().min(1).optional(),
  minimumNumberOfCalls: z.number().min(1).optional(),
  slidingWindowSize: z.number().min(5).optional(),
});

export function GET() {
  registry.ensureInitialized();
  const circuits = registry.getAll().map(cb => ({
    ...cb.toJSON(),
    slidingWindow: cb.slidingWindowSnapshot,
  }));
  return NextResponse.json(circuits);
}

export async function POST(req: NextRequest) {
  registry.ensureInitialized();
  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, serviceName, ...rest } = parsed.data;
  const id = `${serviceName}-circuit-${Date.now()}`;

  if (registry.getByService(serviceName)) {
    return NextResponse.json({ error: `Circuit for service '${serviceName}' already exists` }, { status: 409 });
  }

  const cb = registry.create(id, { ...DEFAULT_CONFIG, name, serviceName, ...rest });
  return NextResponse.json(cb.toJSON(), { status: 201 });
}
