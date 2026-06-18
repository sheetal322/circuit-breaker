"use client";

import { motion } from "framer-motion";
import type { CallRecord } from "@/lib/circuit-breaker/types";

interface Props {
  records: CallRecord[];
  slowThresholdMs?: number;
}

export function SlidingWindowViz({ records, slowThresholdMs = 2000 }: Props) {
  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-10 text-zinc-600 text-xs">
        No calls recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {records.map((record, i) => {
          const isSlow = record.durationMs >= slowThresholdMs;
          const isFailure = record.outcome === "failure";
          const color = isFailure
            ? "bg-red-500"
            : isSlow
              ? "bg-amber-500"
              : "bg-emerald-500";

          return (
            <motion.div
              key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15, delay: i * 0.01 }}
              title={`${record.outcome} — ${record.durationMs.toFixed(0)}ms`}
              className={`w-4 h-4 rounded-sm ${color} opacity-80 cursor-default`}
            />
          );
        })}
      </div>
      <div className="flex gap-4 text-xs ">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />{" "}
          Success
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />{" "}
          Slow (&gt;{slowThresholdMs}ms)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />{" "}
          Failure
        </span>
      </div>
    </div>
  );
}
