"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCircuitEvents } from "@/hooks/useCircuitEvents";
import { StateMachineViz } from "@/components/circuit-diagram/StateMachineViz";
import { MetricsChart } from "@/components/metrics/MetricsChart";
import { SlidingWindowViz } from "@/components/metrics/SlidingWindowViz";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CircuitBreakerConfig,
  CallRecord,
  CircuitEvent,
} from "@/lib/circuit-breaker/types";

interface CircuitDetail {
  id: string;
  config: CircuitBreakerConfig;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  metrics: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    failureRate: number;
    slowCallRate: number;
    avgDurationMs: number;
    notPermittedCalls: number;
    slowCalls: number;
    state: string;
    lastStateChangeAt: number;
  };
  slidingWindow: CallRecord[];
  events: CircuitEvent[];
  history: Array<{
    failureRate: number;
    successRate: number;
    avgDurationMs: number;
    timestamp: number;
  }>;
}

const STATE_COLOR = {
  CLOSED: "text-emerald-400",
  OPEN: "text-red-400",
  HALF_OPEN: "text-amber-400",
} as const;

export default function CircuitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<CircuitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CircuitBreakerConfig>>({});

  const { circuits, events } = useCircuitEvents();
  const liveCircuit = circuits.get(id);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/circuits/${encodeURIComponent(id)}`);
    if (res.ok) setDetail((await res.json()) as CircuitDetail);
    setLoading(false);
  }, [id]);

  const handleEditStart = () => {
    if (detail?.config) {
      setFormData(detail.config);
      setIsEditing(true);
      setError(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/circuits/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error?.message || "Failed to update circuit");
        return;
      }
      await fetchDetail();
      setIsEditing(false);
      setFormData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete this circuit? This cannot be undone.`)) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/circuits/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Failed to delete circuit");
        return;
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Refresh sliding window + metrics from server every 3s when live events come in
  useEffect(() => {
    if (!liveCircuit) return;
    const t = setTimeout(fetchDetail, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCircuit?.metrics.totalCalls]);

  const circuitEvents = events.filter((e) => e.circuitId === id);
  const state = liveCircuit?.state ?? detail?.state ?? "CLOSED";
  const metrics = liveCircuit?.metrics ?? detail?.metrics;
  const config = detail?.config;

  const chartData = (detail?.history ?? []).map((h) => ({
    ...h,
    successRate: 100 - h.failureRate,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center">
        <span className="text-sm text-slate-500">Loading circuit…</span>
      </div>
    );
  }

  if (!detail && !liveCircuit) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center gap-4">
        <p className="">Circuit not found</p>
        <Link href="/" className="text-sm text-slate-500 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="bg-black px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-white/80 hover:text-white text-sm transition-colors"
            >
              ← Dashboard
            </Link>
            <span className="text-white/50">/</span>
            <h1 className="font-semibold text-white">{config?.name ?? id}</h1>
          </div>
          <Badge
            variant="outline"
            className={`font-mono text-xs border-current ${STATE_COLOR[state]}`}
          >
            {state}
          </Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Metrics row */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Calls", value: metrics.totalCalls },
              {
                label: "Failure Rate",
                value: `${metrics.failureRate.toFixed(1)}%`,
                red: metrics.failureRate >= 50,
              },
              {
                label: "Avg Latency",
                value: `${Math.round(metrics.avgDurationMs)}ms`,
                red: metrics.avgDurationMs >= 2000,
              },
              {
                label: "Blocked",
                value: metrics.notPermittedCalls,
                red: metrics.notPermittedCalls > 0,
              },
            ].map(({ label, value, red }) => (
              <Card key={label} className="bg-white border-slate-200">
                <CardContent className="pt-4 pb-3">
                  <p className="font-semibold mb-1">{label}</p>
                  <p
                    className={`text-2xl font-bold font-mono ${red ? "text-red-500" : "text-slate-900"}`}
                  >
                    {value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="metrics">
              <TabsList className="bg-slate-100 border border-slate-200">
                <TabsTrigger
                  value="metrics"
                  className="text-xs text-slate-500 hover:text-black data-active:text-slate-900"
                >
                  Metrics
                </TabsTrigger>
                <TabsTrigger
                  value="window"
                  className="text-xs text-slate-500 hover:text-black data-active:text-slate-900"
                >
                  Sliding Window
                </TabsTrigger>
                <TabsTrigger
                  value="events"
                  className="text-xs text-slate-500 hover:text-black data-active:text-slate-900"
                >
                  Event Log
                </TabsTrigger>
                <TabsTrigger
                  value="config"
                  className="text-xs text-slate-500 hover:text-black data-active:text-slate-900"
                >
                  Config
                </TabsTrigger>
              </TabsList>

              <TabsContent value="metrics">
                <Card className="bg-white border-slate-200 mt-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Last 5 minutes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MetricsChart data={chartData} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="window">
                <Card className="bg-white border-slate-200 mt-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Sliding Window ({detail?.slidingWindow?.length ?? 0} /{" "}
                      {config?.slidingWindowSize ?? 20} slots)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SlidingWindowViz
                      records={detail?.slidingWindow ?? []}
                      slowThresholdMs={config?.slowCallDurationThreshold}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="events">
                <Card className="bg-white border-slate-200 mt-3">
                  <CardContent className="pt-4">
                    <EventFeed
                      events={[
                        ...circuitEvents,
                        ...(detail?.events ?? []),
                      ].slice(0, 100)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="config">
                {config && (
                  <Card className="bg-white border-slate-200 mt-3">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Configuration</CardTitle>
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleEditStart}
                            className="h-7 text-xs"
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {error && (
                        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                          {error}
                        </div>
                      )}

                      {isEditing ? (
                        <div className="space-y-4">
                          {[
                            { key: "name", label: "Name", type: "text" },
                            {
                              key: "failureRateThreshold",
                              label: "Failure Rate %",
                              type: "number",
                            },
                            {
                              key: "slowCallRateThreshold",
                              label: "Slow Call Rate %",
                              type: "number",
                            },
                            {
                              key: "slowCallDurationThreshold",
                              label: "Slow Duration (ms)",
                              type: "number",
                            },
                            {
                              key: "waitDurationInOpenState",
                              label: "Wait Duration (ms)",
                              type: "number",
                            },
                            {
                              key: "permittedCallsInHalfOpen",
                              label: "Permitted Calls (Half-Open)",
                              type: "number",
                            },
                            {
                              key: "minimumNumberOfCalls",
                              label: "Minimum Calls",
                              type: "number",
                            },
                            {
                              key: "slidingWindowSize",
                              label: "Sliding Window Size",
                              type: "number",
                            },
                          ].map(({ key, label, type }) => (
                            <div key={key}>
                              <label className="font-semibold block mb-1.5">
                                {label}
                              </label>
                              <input
                                type={type}
                                value={
                                  formData[key as keyof CircuitBreakerConfig] ??
                                  config[key as keyof CircuitBreakerConfig] ??
                                  ""
                                }
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    [key]:
                                      type === "number"
                                        ? Number(e.target.value)
                                        : e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-black"
                              />
                            </div>
                          ))}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={handleSave}
                              disabled={isSaving}
                              className="flex-1 h-8 text-xs"
                            >
                              {isSaving ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsEditing(false);
                                setFormData({});
                                setError(null);
                              }}
                              disabled={isSaving}
                              className="flex-1 h-8 text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <dl className="grid grid-cols-2 gap-3">
                            {Object.entries(config)
                              .filter(([k]) => !["serviceName"].includes(k))
                              .map(([k, v]) => (
                                <div key={k}>
                                  <dt className="font-semibold font-mono">{k}</dt>
                                  <dd className="font-semibold font-mono mt-0.5">
                                    {k.includes("Rate")
                                      ? `${v}%`
                                      : k.includes("Duration") ||
                                          k.includes("Wait")
                                        ? `${v}ms`
                                        : String(v)}
                                  </dd>
                                </div>
                              ))}
                          </dl>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="w-full h-8 text-xs mt-4"
                          >
                            {isDeleting ? "Deleting…" : "Delete Circuit"}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column: state machine */}
          <div className="space-y-4">
            <Card className="bg-white border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">State Machine</CardTitle>
              </CardHeader>
              <CardContent>
                <StateMachineViz state={state} config={config} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
