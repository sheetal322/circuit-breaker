"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useCircuitEvents } from "@/hooks/useCircuitEvents";
import { CircuitCard } from "@/components/dashboard/CircuitCard";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

// base-ui Slider returns `number | readonly number[]` — extract first value safely
const sliderVal = (v: number | readonly number[]): number =>
  Array.isArray(v) ? (v as number[])[0] : (v as number);

const SERVICES = ["payment", "user", "inventory", "notification", "order"];

interface ServiceProfile {
  serviceName: string;
  errorRate: number;
  timeoutRate: number;
  baseLatencyMs: number;
  latencyJitterMs: number;
}

interface TrafficSession {
  serviceName: string;
  active: boolean;
}

const PRESETS = [
  {
    id: "cascade_failure",
    label: "Cascade Failure",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    desc: "80% errors on all services",
  },
  {
    id: "gradual_degradation",
    label: "Gradual Degradation",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    desc: "Error rate ramps 10% → 80%",
  },
  {
    id: "spike_and_recover",
    label: "Spike & Recover",
    color: "bg-blue-500/20 text-white/50 border-blue-500/30",
    desc: "65% errors for 20s then 0%",
  },
  {
    id: "slow_burn",
    label: "Slow Burn",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    desc: "2.5s latency (slow calls)",
  },
  {
    id: "reset_all",
    label: "Reset All",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    desc: "Restore all services to normal",
  },
] as const;

export default function PlaygroundPage() {
  const { connected, circuits, events } = useCircuitEvents();
  const circuitList = Array.from(circuits.values());

  const [profiles, setProfiles] = useState<ServiceProfile[]>([]);
  const [traffic, setTraffic] = useState<TrafficSession[]>([]);
  const [rps, setRps] = useState<Record<string, number>>(
    Object.fromEntries(SERVICES.map((s) => [s, 10])),
  );
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    const res = await fetch("/api/playground/inject");
    if (res.ok) setProfiles((await res.json()) as ServiceProfile[]);
  }, []);

  const fetchTraffic = useCallback(async () => {
    const res = await fetch("/api/playground/traffic");
    if (res.ok) setTraffic((await res.json()) as TrafficSession[]);
  }, []);

  useEffect(() => {
    fetchProfiles();
    fetchTraffic();
    const t = setInterval(() => {
      fetchProfiles();
      fetchTraffic();
    }, 3000);
    return () => clearInterval(t);
  }, [fetchProfiles, fetchTraffic]);

  const patchProfile = async (
    serviceName: string,
    patch: Partial<ServiceProfile>,
  ) => {
    await fetch("/api/playground/inject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceName, ...patch }),
    });
    await fetchProfiles();
  };

  const toggleTraffic = async (serviceName: string) => {
    const session = traffic.find((t) => t.serviceName === serviceName);
    if (session?.active) {
      await fetch("/api/playground/traffic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", serviceName }),
      });
    } else {
      await fetch("/api/playground/traffic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceName, rps: rps[serviceName] ?? 10 }),
      });
    }
    await fetchTraffic();
  };

  const runPreset = async (preset: string) => {
    setActivePreset(preset);
    await fetch("/api/playground/preset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset }),
    });
    setTimeout(
      () => {
        setActivePreset(null);
        fetchProfiles();
      },
      preset === "gradual_degradation"
        ? 30000
        : preset === "spike_and_recover"
          ? 20000
          : 1000,
    );
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="bg-black px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white/80 hover:text-white text-sm transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-white/50">/</span>
            <h1 className="text-sm font-semibold text-white">Playground</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-white/40"}`}
            />
            <span className="text-xs text-white/80">
              {connected ? "Live" : "Connecting…"}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Controls column */}
          <div className="xl:col-span-2 space-y-6">
            {/* Scenario Presets */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Scenario Presets
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESETS.map((p) => (
                  <motion.button
                    key={p.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => runPreset(p.id)}
                    disabled={activePreset !== null}
                    className={`
                      text-left p-3 rounded-xl border transition-all
                      ${p.color}
                      ${activePreset === p.id ? "ring-2 ring-current" : ""}
                      ${activePreset && activePreset !== p.id ? "opacity-40" : ""}
                      disabled:cursor-not-allowed
                    `}
                  >
                    <p className="text-xs font-semibold">{p.label}</p>
                    <p className="text-xs opacity-70 mt-0.5 leading-tight">
                      {p.desc}
                    </p>
                    {activePreset === p.id && (
                      <span className="inline-block mt-1 text-xs animate-pulse">
                        Running…
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </section>

            <Separator className="bg-slate-200" />

            {/* Per-service controls */}
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-3">
                Service Controls
              </h2>
              <div className="space-y-4">
                {SERVICES.map((serviceName) => {
                  const profile = profiles.find(
                    (p) => p.serviceName === serviceName,
                  );
                  const session = traffic.find(
                    (t) => t.serviceName === serviceName,
                  );
                  const isActive = session?.active ?? false;
                  const circuit = circuitList.find(
                    (c) => c.circuitId === `${serviceName}-circuit`,
                  );

                  return (
                    <Card
                      key={serviceName}
                      className="bg-white border-slate-200"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm capitalize">
                              {serviceName} Service
                            </CardTitle>
                            {circuit && (
                              <Badge
                                variant="outline"
                                className={`text-xs border-current font-mono ${
                                  circuit.state === "CLOSED"
                                    ? "text-emerald-400"
                                    : circuit.state === "OPEN"
                                      ? "text-red-400"
                                      : "text-amber-400"
                                }`}
                              >
                                {circuit.state}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs ">
                                {rps[serviceName]} RPS
                              </span>
                              <div className="w-20">
                                <Slider
                                  min={1}
                                  max={50}
                                  step={1}
                                  value={[rps[serviceName] ?? 10]}
                                  onValueChange={(vals) =>
                                    setRps((prev) => ({
                                      ...prev,
                                      [serviceName]: sliderVal(vals),
                                    }))
                                  }
                                  className="cursor-pointer"
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => toggleTraffic(serviceName)}
                              className={`
                                px-3 py-1 rounded-lg text-xs font-semibold transition-all
                                ${
                                  isActive
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                                }
                              `}
                            >
                              {isActive ? "Stop" : "Start"}
                            </button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs  block mb-1.5">
                              Error Rate:{" "}
                              <span
                                className={`font-mono font-bold ${(profile?.errorRate ?? 0) >= 50 ? "text-red-500" : "text-slate-900"}`}
                              >
                                {profile?.errorRate ?? 0}%
                              </span>
                            </label>
                            <Slider
                              min={0}
                              max={100}
                              step={5}
                              value={[profile?.errorRate ?? 0]}
                              onValueChange={(vals) =>
                                patchProfile(serviceName, {
                                  errorRate: sliderVal(vals),
                                })
                              }
                              className="cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="text-xs  block mb-1.5">
                              Latency:{" "}
                              <span
                                className={`font-mono font-bold ${(profile?.baseLatencyMs ?? 100) >= 2000 ? "text-amber-500" : "text-slate-900"}`}
                              >
                                {profile?.baseLatencyMs ?? 100}ms
                              </span>
                            </label>
                            <Slider
                              min={10}
                              max={5000}
                              step={50}
                              value={[profile?.baseLatencyMs ?? 100]}
                              onValueChange={(vals) =>
                                patchProfile(serviceName, {
                                  baseLatencyMs: sliderVal(vals),
                                })
                              }
                              className="cursor-pointer"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right column: live circuit states + event feed */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Circuit States
            </h2>
            <div className="space-y-3">
              {circuitList.map((circuit) => (
                <CircuitCard key={circuit.circuitId} circuit={circuit} />
              ))}
              {circuitList.length === 0 && (
                <p className="text-xs text-slate-400">Connecting…</p>
              )}
            </div>

            <Separator className="bg-slate-200" />

            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">
                Live Events
              </h2>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <EventFeed events={events} maxVisible={30} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
