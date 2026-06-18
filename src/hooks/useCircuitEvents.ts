'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { CircuitEvent, CircuitBreakerMetrics, CircuitState } from '@/lib/circuit-breaker/types';

export interface CircuitSnapshot {
  circuitId: string;
  circuitName: string;
  state: CircuitState;
  metrics: CircuitBreakerMetrics;
  timestamp: number;
}

export interface UseCircuitEventsReturn {
  connected: boolean;
  circuits: Map<string, CircuitSnapshot>;
  events: CircuitEvent[];
  lastEvent: CircuitEvent | null;
}

export function useCircuitEvents(maxEvents = 200): UseCircuitEventsReturn {
  const [connected, setConnected] = useState(false);
  const [circuits, setCircuits] = useState<Map<string, CircuitSnapshot>>(new Map());
  const [events, setEvents] = useState<CircuitEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<CircuitEvent | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const applyEvent = useCallback((event: CircuitEvent) => {
    setLastEvent(event);
    setEvents(prev => [event, ...prev].slice(0, maxEvents));

    if (event.metrics) {
      setCircuits(prev => {
        const next = new Map(prev);
        next.set(event.circuitId, {
          circuitId: event.circuitId,
          circuitName: event.circuitName,
          state: event.metrics!.state,
          metrics: event.metrics!,
          timestamp: event.timestamp,
        });
        return next;
      });
    }
  }, [maxEvents]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e: MessageEvent) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = JSON.parse(e.data as string) as any;

        if (data.type === 'connected' && data.circuits) {
          setConnected(true);
          setCircuits(new Map(data.circuits.map((c: CircuitSnapshot) => [c.circuitId, c])));
        } else {
          applyEvent(data as CircuitEvent);
        }
      } catch { /* malformed message */ }
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [applyEvent]);

  return { connected, circuits, events, lastEvent };
}
