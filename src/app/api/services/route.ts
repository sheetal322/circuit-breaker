import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const circuits = db.listCircuits();
  const services = Array.from(
    new Set(circuits.map((c) => c.config.serviceName))
  ).sort();

  return NextResponse.json(services);
}
