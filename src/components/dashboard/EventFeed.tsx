"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { CircuitEvent, CircuitState } from "@/lib/circuit-breaker/types";

const TYPE_STYLE: Record<
  CircuitEvent["type"],
  { dot: string; text: string; label: string }
> = {
  state_change: {
    dot: "bg-blue-500",
    text: "text-blue-400",
    label: "STATE CHANGE",
  },
  success: {
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    label: "SUCCESS",
  },
  failure: { dot: "bg-red-500", text: "text-red-400", label: "FAILURE" },
  slow_call: {
    dot: "bg-amber-500",
    text: "text-amber-400",
    label: "SLOW CALL",
  },
  not_permitted: { dot: "bg-zinc-500", text: "", label: "BLOCKED" },
};

const STATE_COLOR: Record<CircuitState, string> = {
  CLOSED: "text-emerald-400",
  OPEN: "text-red-400",
  HALF_OPEN: "text-amber-400",
};

interface Props {
  events: CircuitEvent[];
  maxVisible?: number;
}

export function EventFeed({ events, maxVisible = 50 }: Props) {
  const visible = events.slice(0, maxVisible);

  return (
    <div className="space-y-0.5 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
      <AnimatePresence initial={false}>
        {visible.map((event, i) => {
          const style = TYPE_STYLE[event.type];
          return (
            <motion.div
              key={`${event.circuitId}-${event.timestamp}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-start gap-2.5 py-1.5 border-b border-white/4"
            >
              <span
                className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold font-mono ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="text-xs  truncate">{event.circuitName}</span>
                  {event.type === "state_change" &&
                    event.fromState &&
                    event.toState && (
                      <span className="text-xs text-zinc-600">
                        <span className={STATE_COLOR[event.fromState]}>
                          {event.fromState}
                        </span>
                        {" → "}
                        <span className={STATE_COLOR[event.toState]}>
                          {event.toState}
                        </span>
                      </span>
                    )}
                  {event.durationMs != null && (
                    <span className="text-xs text-zinc-600 font-mono">
                      {event.durationMs.toFixed(0)}ms
                    </span>
                  )}
                </div>
                {event.error && (
                  <p className="text-xs text-red-400/70 mt-0.5 truncate">
                    {event.error}
                  </p>
                )}
              </div>
              <span className="text-xs text-zinc-600 font-mono flex-shrink-0">
                {new Date(event.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {visible.length === 0 && (
        <p className="text-xs text-zinc-600 py-4 text-center">
          No events yet — start some traffic
        </p>
      )}
    </div>
  );
}
