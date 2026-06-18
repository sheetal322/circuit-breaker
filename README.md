# Circuit Breaker — Resilience Dashboard

A production-grade circuit breaker visualizer built with Next.js 16. Observe real-time state transitions, inject failures, and tune thresholds through a live dashboard and interactive playground.

## What it does

The circuit breaker pattern prevents cascading failures by automatically stopping calls to a degrading service and giving it time to recover. This app implements the full state machine and lets you watch it in action:

- **CLOSED** — normal operation, all calls pass through
- **OPEN** — tripped, all calls are instantly rejected without hitting the service
- **HALF_OPEN** — recovery probe, a limited number of test calls go through; if they succeed the circuit closes, if any fail it opens again

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Five circuits are pre-registered on first run: Payment, User, Inventory, Notification, and Order — each with slightly different default thresholds.

## Pages

### Dashboard `/`
Live overview of all circuits. Each card shows state, failure rate, avg latency, total calls, and blocked calls. Updates in real time via SSE.

### Circuit Detail `/circuits/[id]`
Deep-dive into a single circuit:
- **Metrics** — failure rate and latency chart over time
- **Sliding Window** — the last N calls visualized as pass/fail slots
- **Event Log** — every state change, failure, slow call, and blocked call
- **Config** — edit thresholds live (changes take effect immediately)

### Playground `/playground`
Inject controlled chaos without writing any code:
- Set **error rate** and **latency** per service using sliders
- Control **requests per second** and start/stop traffic independently per service
- Use **scenario presets** for one-click chaos:
  - **Cascade Failure** — 80% errors on all services at once
  - **Gradual Degradation** — error rate ramps from 10% → 80% over 30s
  - **Spike & Recover** — 65% errors for 20s then back to 0%
  - **Slow Burn** — 2.5s latency triggers the slow call threshold

## How the circuit trips

The circuit evaluates health after every call using a **sliding window** (default: last 20 calls). It trips to OPEN when either condition is met — but only after a minimum number of calls:

| Config field | Default | Meaning |
|---|---|---|
| `minimumNumberOfCalls` | 10 | Won't evaluate until at least this many calls |
| `failureRateThreshold` | 50% | Trip if ≥ this % of calls fail |
| `slowCallRateThreshold` | 100% | Trip if ≥ this % of calls exceed slow duration |
| `slowCallDurationThreshold` | 2000ms | A call is "slow" above this latency |
| `waitDurationInOpenState` | 10000ms | Time OPEN before auto-transitioning to HALF_OPEN |
| `permittedCallsInHalfOpen` | 5 | Test calls allowed in HALF_OPEN before deciding |
| `slidingWindowSize` | 20 | Number of recent calls to evaluate |

**Note:** `failureRateThreshold` in the Config tab is the *trip threshold*, not the injected error rate. To actually generate failures, use the error rate slider in the Playground.

## Quick demo

1. Start the dev server and open the dashboard
2. Go to **Playground**
3. Set the **User** service error rate to **70%**
4. Click **Start** — traffic begins flowing
5. After ~10 calls the failure rate exceeds 50% → circuit flips to **OPEN** (red)
6. Blocked calls start accumulating — calls are rejected instantly
7. After 10 seconds → auto-transitions to **HALF_OPEN** (amber)
8. 5 probe calls go through — if they fail → back to OPEN; if they succeed → back to CLOSED (green)

Or click **Cascade Failure** to see all five circuits trip simultaneously.

## Tech stack

- **Next.js 16** (App Router) with React 19
- **better-sqlite3** — embedded database for circuit state and call history
- **SSE** (`/api/events`) — server-sent events for real-time dashboard updates
- **Recharts** — metrics charts
- **Framer Motion** — state transition animations
- **Base UI + shadcn** — headless component primitives
- **Tailwind CSS v4** — styling
- **Zod** — API input validation

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Dashboard
│   ├── circuits/[id]/page.tsx    # Circuit detail
│   ├── playground/page.tsx       # Chaos playground
│   └── api/
│       ├── circuits/             # CRUD + PATCH config
│       ├── events/               # SSE stream
│       ├── playground/           # Traffic + fault injection
│       └── services/[name]/      # Per-service call endpoint
├── components/
│   ├── dashboard/                # CircuitCard, EventFeed
│   ├── metrics/                  # MetricsChart, SlidingWindowViz
│   └── circuit-diagram/          # StateMachineViz
└── lib/
    ├── circuit-breaker/          # Core CircuitBreaker, SlidingWindow, Registry
    ├── db/                       # SQLite persistence layer
    └── events/                   # EventBus for SSE broadcasting
```
