"use client";

import { motion } from "framer-motion";
import type { CircuitState } from "@/lib/circuit-breaker/types";

const STATES: CircuitState[] = ["CLOSED", "OPEN", "HALF_OPEN"];

const STATE_STYLE: Record<
  CircuitState,
  {
    border: string;
    bg: string;
    text: string;
    glow: string;
    label: string;
    desc: string;
  }
> = {
  CLOSED: {
    border: "border-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/30",
    label: "CLOSED",
    desc: "Calls pass through",
  },
  OPEN: {
    border: "border-red-500",
    bg: "bg-red-500/10",
    text: "text-red-400",
    glow: "shadow-red-500/30",
    label: "OPEN",
    desc: "Fail fast",
  },
  HALF_OPEN: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    glow: "shadow-amber-500/30",
    label: "HALF-OPEN",
    desc: "Testing recovery",
  },
};

interface Props {
  state: CircuitState;
  config?: {
    failureRateThreshold: number;
    waitDurationInOpenState: number;
    permittedCallsInHalfOpen: number;
  };
}

export function StateMachineViz({ state, config }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center gap-6">
        {/* CLOSED node */}
        <StateNode state="CLOSED" active={state === "CLOSED"} />

        {/* CLOSED → OPEN arrow */}
        <div className="flex flex-col items-center gap-1">
          <Arrow
            direction="right"
            active={state === "OPEN"}
            label={`≥${config?.failureRateThreshold ?? 50}% failures`}
          />
        </div>

        {/* OPEN node */}
        <StateNode state="OPEN" active={state === "OPEN"} />
      </div>

      <div
        className="flex items-center w-full px-4 justify-between"
        style={{ paddingLeft: "6rem", paddingRight: "6rem" }}
      >
        {/* HALF_OPEN → CLOSED arrow (below left) */}
        <div className="flex flex-col items-center">
          <Arrow
            direction="up-left"
            active={state === "CLOSED" && false}
            label="Test calls pass"
          />
        </div>
        {/* OPEN → HALF_OPEN arrow (below right) */}
        <div className="flex flex-col items-center">
          <Arrow
            direction="down-left"
            active={state === "HALF_OPEN"}
            label={`After ${(config?.waitDurationInOpenState ?? 10000) / 1000}s`}
          />
        </div>
      </div>

      {/* HALF_OPEN node centered below */}
      <StateNode state="HALF_OPEN" active={state === "HALF_OPEN"} />

      <p className="text-xs  mt-1">
        {STATE_STYLE[state].desc}
        {state === "HALF_OPEN" &&
          config &&
          ` — ${config.permittedCallsInHalfOpen} test calls allowed`}
      </p>
    </div>
  );
}

function StateNode({
  state,
  active,
}: {
  state: CircuitState;
  active: boolean;
}) {
  const s = STATE_STYLE[state];
  return (
    <motion.div
      animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={
        active ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}
      }
      className={`
        relative w-28 h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5
        transition-all duration-300
        ${active ? `${s.border} ${s.bg} shadow-lg ${s.glow}` : "border-white/10 bg-white/3"}
      `}
    >
      <span
        className={`text-xs font-bold font-mono ${active ? s.text : "text-zinc-600"}`}
      >
        {s.label}
      </span>
      {active && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              state === "CLOSED"
                ? "bg-emerald-400"
                : state === "OPEN"
                  ? "bg-red-400"
                  : "bg-amber-400"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
              state === "CLOSED"
                ? "bg-emerald-500"
                : state === "OPEN"
                  ? "bg-red-500"
                  : "bg-amber-500"
            }`}
          />
        </span>
      )}
    </motion.div>
  );
}

function Arrow({
  direction,
  active,
  label,
}: {
  direction: string;
  active: boolean;
  label: string;
}) {
  void direction; // used for layout positioning via parent
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`text-xs text-center max-w-20 leading-tight ${active ? "text-white/60" : "text-zinc-600"}`}
      >
        {label}
      </span>
      <div className={`h-px w-12 ${active ? "bg-white/30" : "bg-white/10"}`} />
    </div>
  );
}
