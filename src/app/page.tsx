"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCircuitEvents } from "@/hooks/useCircuitEvents";
import { CircuitCard } from "@/components/dashboard/CircuitCard";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";

const inputCls =
  "w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-black";
const labelCls = "text-sm font-semibold block mb-1.5";

export default function DashboardPage() {
  const router = useRouter();
  const { connected, circuits, events } = useCircuitEvents();
  const circuitList = Array.from(circuits.values());

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", serviceName: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCount = circuitList.filter((c) => c.state === "OPEN").length;
  const halfOpenCount = circuitList.filter((c) => c.state === "HALF_OPEN").length;

  const handleCreate = async () => {
    if (!form.name.trim() || !form.serviceName.trim()) {
      setError("Name and service name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/circuits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), serviceName: form.serviceName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to create circuit.");
        return;
      }
      setOpen(false);
      setForm({ name: "", serviceName: "" });
      router.push(`/circuits/${encodeURIComponent(data.id)}`);
    } catch {
      setError("An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="bg-black px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm font-bold text-white">
              CB
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Circuit Breaker</h1>
              <p className="text-xs text-white/70">Resilience Dashboard</p>
            </div>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/playground"
              className="text-sm text-white/80 hover:text-white transition-colors"
            >
              Playground
            </Link>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-white/40"}`}
              />
              <span className="text-xs text-white/80">
                {connected ? "Live" : "Connecting…"}
              </span>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary bar */}
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-xl font-semibold">{circuitList.length} Circuits</h2>
          {openCount > 0 && (
            <Badge variant="outline" className="text-red-400 border-red-500/40 text-xs">
              {openCount} OPEN
            </Badge>
          )}
          {halfOpenCount > 0 && (
            <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-xs">
              {halfOpenCount} HALF-OPEN
            </Badge>
          )}
          {openCount === 0 && halfOpenCount === 0 && circuitList.length > 0 && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 text-xs">
              All healthy
            </Badge>
          )}

          <div className="ml-auto">
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (!o) { setError(null); setForm({ name: "", serviceName: "" }); }
              }}
            >
              <DialogTrigger
                className="px-3 py-1.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors"
              >
                + New Circuit
              </DialogTrigger>
              <DialogContent className="bg-white text-slate-900 border-slate-200">
                <DialogHeader>
                  <DialogTitle>New Circuit</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. Payment Circuit"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Service Name</label>
                    <input
                      className={inputCls}
                      placeholder="e.g. payment"
                      value={form.serviceName}
                      onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Must be unique. Thresholds can be tuned after creation.
                    </p>
                  </div>
                  {error && (
                    <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-3 py-2">
                      {error}
                    </p>
                  )}
                </div>

                <DialogFooter>
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  >
                    {saving ? "Creating…" : "Create Circuit"}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Circuit grid */}
          <div className="lg:col-span-2">
            {circuitList.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm border border-slate-200 rounded-xl">
                {connected ? "No circuits registered" : "Connecting to event stream…"}
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
                <h3 className="text-sm font-semibold">Live Events</h3>
                <span className="text-xs text-slate-400">{events.length} captured</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <EventFeed events={events} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick link to playground */}
        {circuitList.length > 0 && (
          <div className="mt-10 p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ready to test?</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate traffic and inject failures in the Playground.
              </p>
            </div>
            <Link
              href="/playground"
              className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Open Playground →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
