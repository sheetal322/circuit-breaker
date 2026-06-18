export interface ServiceProfile {
  name: string;
  baseLatencyMs: number;
  latencyJitterMs: number;
  errorRate: number;       // 0–100
  timeoutRate: number;     // 0–100
  timeoutMs: number;
}

export interface CallResult {
  success: true;
  durationMs: number;
  data?: unknown;
}

const g = global as unknown as { _serviceProfiles?: Map<string, ServiceProfile> };
if (!g._serviceProfiles) g._serviceProfiles = new Map();
const profiles = g._serviceProfiles;

export function setServiceProfile(name: string, patch: Partial<ServiceProfile>): void {
  const existing = profiles.get(name) ?? getDefaultProfile(name);
  profiles.set(name, { ...existing, ...patch });
}

export function getServiceProfile(name: string): ServiceProfile {
  return profiles.get(name) ?? getDefaultProfile(name);
}

export function resetServiceProfile(name: string): void {
  profiles.delete(name);
}

function getDefaultProfile(name: string): ServiceProfile {
  const defaults: Record<string, Partial<ServiceProfile>> = {
    payment:      { baseLatencyMs: 150, latencyJitterMs: 80,  errorRate: 0, timeoutRate: 0, timeoutMs: 3000 },
    user:         { baseLatencyMs: 50,  latencyJitterMs: 20,  errorRate: 0, timeoutRate: 0, timeoutMs: 2000 },
    inventory:    { baseLatencyMs: 80,  latencyJitterMs: 40,  errorRate: 0, timeoutRate: 0, timeoutMs: 2500 },
    notification: { baseLatencyMs: 200, latencyJitterMs: 100, errorRate: 0, timeoutRate: 0, timeoutMs: 4000 },
    order:        { baseLatencyMs: 120, latencyJitterMs: 60,  errorRate: 0, timeoutRate: 0, timeoutMs: 3000 },
  };
  return { name, baseLatencyMs: 100, latencyJitterMs: 50, errorRate: 0, timeoutRate: 0, timeoutMs: 3000, ...defaults[name] };
}

export async function callService(serviceName: string): Promise<CallResult> {
  const profile = getServiceProfile(serviceName);
  const jitter = Math.random() * profile.latencyJitterMs;
  const latency = profile.baseLatencyMs + jitter;

  const isError = Math.random() * 100 < profile.errorRate;
  const isTimeout = !isError && Math.random() * 100 < profile.timeoutRate;

  if (isTimeout) {
    await sleep(profile.timeoutMs + 500);
    // Throw so CircuitBreaker.execute() registers a failure
    throw Object.assign(new Error('Service timeout'), { durationMs: profile.timeoutMs + 500 });
  }

  await sleep(latency);

  if (isError) {
    const errors = [
      'Internal Server Error', 'Service Unavailable', 'Database connection failed',
      'Rate limit exceeded', 'Upstream dependency failed',
    ];
    const msg = errors[Math.floor(Math.random() * errors.length)];
    // Throw so CircuitBreaker.execute() registers a failure
    throw Object.assign(new Error(msg), { durationMs: latency });
  }

  return { success: true, durationMs: latency, data: mockResponse(serviceName) };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function mockResponse(service: string): unknown {
  const responses: Record<string, unknown> = {
    payment:      { transactionId: `txn_${rand()}`, status: 'approved', amount: Math.floor(Math.random() * 1000) },
    user:         { userId: `usr_${rand()}`, name: 'Jane Doe', tier: 'premium' },
    inventory:    { itemId: `itm_${rand()}`, stock: Math.floor(Math.random() * 500), reserved: false },
    notification: { notificationId: `ntf_${rand()}`, channel: 'email', queued: true },
    order:        { orderId: `ord_${rand()}`, status: 'created', estimatedDelivery: '2 days' },
  };
  return responses[service] ?? { ok: true };
}

function rand(): string {
  return Math.random().toString(36).slice(2, 9);
}
