"use client";

import { useCircuitEvents } from "@/hooks/useCircuitEvents";
import { CircuitCard } from "@/components/dashboard/CircuitCard";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function DashboardPage() {
  const { connected, circuits, events } = useCircuitEvents();
  const circuitList = Array.from(circuits.values());

  const openCount = circuitList.filter((c) => c.state === "OPEN").length;
  const halfOpenCount = circuitList.filter(
    (c) => c.state === "HALF_OPEN",
  ).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">
              CB
            </div>
            <div>
              <h1 className="text-base font-bold">Circuit Breaker</h1>
              <p className="text-xs ">Resilience Dashboard</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/playground"
              className="text-sm  hover:text-white transition-colors"
            >
              Playground
            </Link>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-600"}`}
              />
              <span className="text-xs ">
                {connected ? "Live" : "Connecting…"}
              </span>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary bar */}
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-xl font-semibold">
            {circuitList.length} Circuits
          </h2>
          {openCount > 0 && (
            <Badge
              variant="outline"
              className="text-red-400 border-red-500/40 text-xs"
            >
              {openCount} OPEN
            </Badge>
          )}
          {halfOpenCount > 0 && (
            <Badge
              variant="outline"
              className="text-amber-400 border-amber-500/40 text-xs"
            >
              {halfOpenCount} HALF-OPEN
            </Badge>
          )}
          {openCount === 0 && halfOpenCount === 0 && circuitList.length > 0 && (
            <Badge
              variant="outline"
              className="text-emerald-400 border-emerald-500/40 text-xs"
            >
              All healthy
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Circuit grid */}
          <div className="lg:col-span-2">
            {circuitList.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-zinc-600 text-sm border border-white/8 rounded-xl">
                {connected
                  ? "No circuits registered"
                  : "Connecting to event stream…"}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {circuitList.map((circuit) => (
                  <CircuitCard key={circuit.circuitId} circuit={circuit} />
                ))}
              </div>
            )}
          </div>

          {/* Event feed */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-200">
                  Live Events
                </h3>
                <span className="text-xs ">{events.length} captured</span>
              </div>
              <div className="bg-zinc-900/50 border border-white/8 rounded-xl p-3">
                <EventFeed events={events} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick link to playground */}
        {circuitList.length > 0 && (
          <div className="mt-10 p-4 border border-white/8 rounded-xl bg-white/2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ready to test?</p>
              <p className="text-xs  mt-0.5">
                Generate traffic and inject failures in the Playground.
              </p>
            </div>
            <Link
              href="/playground"
              className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Open Playground →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
