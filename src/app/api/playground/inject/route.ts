import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setServiceProfile, resetServiceProfile, getServiceProfile } from '@/lib/services/MockService';

const InjectSchema = z.object({
  serviceName: z.string(),
  errorRate: z.number().min(0).max(100).optional(),
  timeoutRate: z.number().min(0).max(100).optional(),
  baseLatencyMs: z.number().min(0).optional(),
  latencyJitterMs: z.number().min(0).optional(),
  reset: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = InjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { serviceName, reset, ...patch } = parsed.data;

  if (reset) {
    resetServiceProfile(serviceName);
    return NextResponse.json({ ok: true, profile: getServiceProfile(serviceName) });
  }

  setServiceProfile(serviceName, patch);
  return NextResponse.json({ ok: true, profile: getServiceProfile(serviceName) });
}

export async function GET() {
  const services = ['payment', 'user', 'inventory', 'notification', 'order'];
  const profiles = services.map(s => ({ serviceName: s, ...getServiceProfile(s) }));
  return NextResponse.json(profiles);
}
