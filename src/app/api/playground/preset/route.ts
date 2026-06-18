import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { setServiceProfile, resetServiceProfile } from '@/lib/services/MockService';

const SERVICES = ['payment', 'user', 'inventory', 'notification', 'order'];

type Preset = 'cascade_failure' | 'gradual_degradation' | 'spike_and_recover' | 'slow_burn' | 'reset_all';

const presets: Record<Preset, () => void | Promise<void>> = {
  cascade_failure: () => {
    SERVICES.forEach(s => setServiceProfile(s, { errorRate: 80 }));
  },
  gradual_degradation: async () => {
    // Ramp error rate from 10% to 80% over 30 seconds
    for (let rate = 10; rate <= 80; rate += 10) {
      SERVICES.forEach(s => setServiceProfile(s, { errorRate: rate }));
      await sleep(3000);
    }
  },
  spike_and_recover: async () => {
    SERVICES.forEach(s => setServiceProfile(s, { errorRate: 65 }));
    await sleep(20000);
    SERVICES.forEach(s => setServiceProfile(s, { errorRate: 0 }));
  },
  slow_burn: () => {
    SERVICES.forEach(s => setServiceProfile(s, { baseLatencyMs: 2500, latencyJitterMs: 500 }));
  },
  reset_all: () => {
    SERVICES.forEach(s => resetServiceProfile(s));
  },
};

const PresetSchema = z.object({
  preset: z.enum(['cascade_failure', 'gradual_degradation', 'spike_and_recover', 'slow_burn', 'reset_all']),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = PresetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const fn = presets[parsed.data.preset];
  // Run async presets in background — don't await to avoid request timeout
  Promise.resolve(fn()).catch(() => {});

  return NextResponse.json({ ok: true, preset: parsed.data.preset });
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
