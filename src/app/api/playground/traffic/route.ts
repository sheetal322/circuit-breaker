import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registry } from '@/lib/circuit-breaker/CircuitBreakerRegistry';
import { callService } from '@/lib/services/MockService';
import { CircuitOpenError } from '@/lib/circuit-breaker/CircuitBreaker';

const StartSchema = z.object({
  serviceName: z.string(),
  rps: z.number().min(1).max(100),
  durationSec: z.number().min(1).max(120).optional(),
});

// In-memory traffic sessions keyed by serviceName
const g = global as unknown as {
  _trafficSessions?: Map<string, { active: boolean; intervalId: NodeJS.Timeout; startedAt: number }>;
};
if (!g._trafficSessions) g._trafficSessions = new Map();
const sessions = g._trafficSessions;

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Stop request
  if (body.action === 'stop') {
    const { serviceName } = body as { serviceName: string };
    const session = sessions.get(serviceName);
    if (session) {
      session.active = false;
      clearInterval(session.intervalId);
      sessions.delete(serviceName);
    }
    return NextResponse.json({ ok: true, active: false });
  }

  const parsed = StartSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { serviceName, rps, durationSec } = parsed.data;

  // Stop any existing session for this service
  const existing = sessions.get(serviceName);
  if (existing) {
    clearInterval(existing.intervalId);
    sessions.delete(serviceName);
  }

  const cb = registry.getByService(serviceName);
  if (!cb) return NextResponse.json({ error: `No circuit for service '${serviceName}'` }, { status: 404 });

  const intervalMs = 1000 / rps;
  const session = { active: true, startedAt: Date.now(), intervalId: null as unknown as NodeJS.Timeout };

  session.intervalId = setInterval(async () => {
    if (!session.active) return;
    try {
      await cb.execute(() => callService(serviceName));
    } catch (e) {
      if (!(e instanceof CircuitOpenError)) {
        // service error — circuit already tracked it
      }
    }
  }, intervalMs);

  sessions.set(serviceName, session);

  // Auto-stop after duration
  if (durationSec) {
    setTimeout(() => {
      if (sessions.get(serviceName) === session) {
        session.active = false;
        clearInterval(session.intervalId);
        sessions.delete(serviceName);
      }
    }, durationSec * 1000);
  }

  return NextResponse.json({ ok: true, active: true, rps, serviceName });
}

export function GET() {
  const active = Array.from(sessions.entries()).map(([serviceName, s]) => ({
    serviceName,
    startedAt: s.startedAt,
    active: s.active,
  }));
  return NextResponse.json(active);
}
