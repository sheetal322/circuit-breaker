"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CircuitSnapshot } from "@/hooks/useCircuitEvents";
import type { CircuitState } from "@/lib/circuit-breaker/types";

const STATE_CONFIG: Record<
  CircuitState,
  { color: string; bg: string; ring: string; label: string }
> = {
  CLOSED: {
    color: "text-emerald-400",
    bg: "bg-emerald-500",
    ring: "ring-emerald-500/40",
    label: "CLOSED",
  },
  OPEN: {
    color: "text-red-400",
    bg: "bg-red-500",
    ring: "ring-red-500/40",
    label: "OPEN",
  },
  HALF_OPEN: {
    color: "text-amber-400",
    bg: "bg-amber-500",
    ring: "ring-amber-500/40",
    label: "HALF-OPEN",
  },
};

interface Props {
  circuit: CircuitSnapshot;
}

export function CircuitCard({ circuit }: Props) {
  const cfg = STATE_CONFIG[circuit.state];
  const { metrics } = circuit;

  return (
    <Link href={`/circuits/${circuit.circuitId}`}>
      <Card className="relative overflow-hidden cursor-pointer border border-slate-200 bg-white hover:border-slate-300 transition-all duration-200 hover:shadow-md hover:shadow-slate-200 hover:-translate-y-0.5">
        {/* State glow strip */}
        <div
          className={`absolute top-0 left-0 right-0 h-0.5 ${cfg.bg} opacity-80`}
        />

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-semibold text-slate-900 truncate">
              {circuit.circuitName}
            </CardTitle>
            <AnimatePresence mode="wait">
              <motion.div
                key={circuit.state}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Badge
                  variant="outline"
                  className={`text-xs font-mono font-bold border ${cfg.color} border-current ring-2 ${cfg.ring}`}
                >
                  {cfg.label}
                </Badge>
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="text-xs  font-mono mt-0.5">{circuit.circuitId}</p>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3">
            <Metric
              label="Failure Rate"
              value={`${metrics.failureRate.toFixed(1)}%`}
              highlight={metrics.failureRate >= 50}
            />
            <Metric
              label="Avg Latency"
              value={`${Math.round(metrics.avgDurationMs)}ms`}
              highlight={metrics.avgDurationMs >= 2000}
            />
            <Metric label="Total Calls" value={metrics.totalCalls.toString()} />
            <Metric
              label="Not Permitted"
              value={metrics.notPermittedCalls.toString()}
              highlight={metrics.notPermittedCalls > 0}
            />
          </div>

          {/* Pulse indicator */}
          <div className="flex items-center gap-2 mt-3">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.bg} opacity-60`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${cfg.bg}`}
              />
            </span>
            <span className="text-xs ">
              {circuit.state === "OPEN"
                ? "Failing fast — blocking calls"
                : circuit.state === "HALF_OPEN"
                  ? "Testing recovery…"
                  : "Passing calls through"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="font-semibold mb-0.5">{label}</p>
      <p
        className={`text-sm font-mono font-semibold ${highlight ? "text-red-500" : "text-slate-800"}`}
      >
        {value}
      </p>
    </div>
  );
}
