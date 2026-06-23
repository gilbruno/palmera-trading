# Order Types (Market / Limit / Stop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Market / Limit / Stop order types to the replay engine with intelligent auto-inference, a pending-order price line indicator, and deferred DB creation for Limit/Stop orders (created at activation, not at confirm).

**Architecture:** Split `useReplayEngine`'s single `pendingOrder` state into two phases — `pendingOrder` (Limit/Stop awaiting price trigger) and `activeOrder` (triggered, monitoring SL/TP). `ReplayEngine` infers the order type from the overlay's entry price vs. the current bar's close, renders a price line for pending orders, and calls `createReplayTrade` only at activation for Limit/Stop (immediately for Market). A new `OrderType` Prisma enum persists the type in DB.

**Tech Stack:** Next.js 15, React 19, Prisma, lightweight-charts v5, TypeScript

## Global Constraints

- TypeScript strict mode — no `any` unless there is an existing precedent in the file
- lightweight-charts v5 API only — no v4 methods
- Dark theme: background `#0f1117`, card `#1f2937`, accent indigo `#6366f1`
- Server Actions in `actions.ts` must include session ownership check
- No new npm packages
- Prisma migration required: `prisma migrate dev --name add_order_type`
- `OrderType` enum values: `MARKET`, `LIMIT`, `STOP`
- Price line color for pending order: `#6366f1` (indigo), style dashed
- Inference rule: LONG + entry < close → LIMIT; LONG + entry > close → STOP; entry === close → MARKET. SHORT: entry > close → LIMIT; entry < close → STOP; entry === close → MARKET.
- For Limit/Stop: `createReplayTrade` called at activation (bar that triggers), NOT at EntryConfirmModal confirm click
- For Market: `createReplayTrade` called immediately at EntryConfirmModal confirm click (existing behavior)
- Cancelling a pending Limit/Stop order: no DB record exists yet — just clear state and remove price line
- One order at a time: `pendingOrder` and `activeOrder` are mutually exclusive

---

## File Map

| File | Role |
|---|---|
| `prisma/schema.prisma` | Add `OrderType` enum + `orderType` field on `BacktestTrade` |
| `src/app/(app)/backtest/[id]/replay/useReplayEngine.ts` | Extend `PendingOrder` type, split state into `pendingOrder` + `activeOrder`, add `checkOrderActivation`, refactor `checkOrderFill` → `checkOrderExit`, expose `onOrderActivated` callback, add `cancelPendingOrder` |
| `src/app/(app)/backtest/[id]/replay/actions.ts` | Add `orderType` to `TradeEntry` type, pass it to Prisma |
| `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx` | `inferOrderType` helper, Market snap button, pending price line lifecycle, toolbar badge with type, cancel pending button, updated `handleEntryConfirm` (Market only), new `handleOrderActivated` callback |
| `src/app/(app)/backtest/[id]/replay/EntryConfirmModal.tsx` | Display order type (MARKET / LIMIT BUY / STOP BUY etc.) |

---

## Task 1: Prisma schema — add OrderType

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `OrderType` enum (`MARKET | LIMIT | STOP`), `BacktestTrade.orderType: OrderType @default(MARKET)`

- [ ] **Step 1: Add enum and field to schema**

In `prisma/schema.prisma`, after the existing enums block (search for `enum Direction`), add:

```prisma
enum OrderType {
  MARKET
  LIMIT
  STOP
}
```

Then inside `model BacktestTrade { ... }`, after the `direction Direction` line, add:

```prisma
  orderType OrderType @default(MARKET)
```

- [ ] **Step 2: Run migration**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npx prisma migrate dev --name add_order_type
```

Expected output: `✔ Generated Prisma Client` — migration applied successfully. If the dev DB is reset, this is acceptable.

- [ ] **Step 3: Verify generated client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add OrderType enum to BacktestTrade schema"
```

---

## Task 2: actions.ts — add orderType to TradeEntry

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/actions.ts`

**Interfaces:**
- Consumes: `OrderType` enum from Prisma client (available after Task 1 migration)
- Produces:
  ```ts
  export type TradeEntry = {
    direction: "LONG" | "SHORT";
    orderType: "MARKET" | "LIMIT" | "STOP";  // new
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    entryDate: Date;
  };
  ```
  `createReplayTrade` passes `orderType` to Prisma.

- [ ] **Step 1: Update TradeEntry type**

In `src/app/(app)/backtest/[id]/replay/actions.ts`, replace:

```ts
export type TradeEntry = {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryDate: Date;
};
```

with:

```ts
export type TradeEntry = {
  direction: "LONG" | "SHORT";
  orderType: "MARKET" | "LIMIT" | "STOP";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryDate: Date;
};
```

- [ ] **Step 2: Pass orderType to Prisma in createReplayTrade**

In `createReplayTrade`, inside the `prisma.backtestTrade.create({ data: { ... } })` block, add `orderType: entry.orderType,` after `direction: entry.direction,`:

```ts
  const created = await prisma.backtestTrade.create({
    data: {
      backtestId,
      tradeNumber,
      direction:  entry.direction,
      orderType:  entry.orderType,
      entryDate:  entry.entryDate,
      entryPrice: entry.entryPrice,
      stopLoss:   entry.stopLoss,
      takeProfit: entry.takeProfit,
    },
    select: { id: true },
  });
```

- [ ] **Step 3: Build check**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors on `actions.ts`. (Other files may show errors until Task 3 & 4 are complete — that's acceptable at this stage.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/actions.ts
git commit -m "feat: add orderType to TradeEntry and createReplayTrade"
```

---

## Task 3: useReplayEngine — two-phase order state

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/useReplayEngine.ts`

**Interfaces:**
- Consumes: Nothing from prior tasks (types are self-contained here)
- Produces:
  ```ts
  export type OrderType = "MARKET" | "LIMIT" | "STOP";

  export type PendingOrder = {
    direction: "LONG" | "SHORT";
    orderType: OrderType;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    placedAtIndex: number;   // bar index when order was placed
    entryBarIndex: number;   // bar index when order was activated (set at activation)
  };

  // FilledTrade unchanged — still references order: PendingOrder

  type UseReplayEngineOpts = {
    onTradeFilled: (trade: FilledTrade) => void;
    onOrderActivated?: (order: PendingOrder, activationBar: Bar) => void;
  };

  // Return shape additions:
  pendingOrder: PendingOrder | null   // Limit/Stop awaiting activation
  activeOrder:  PendingOrder | null   // triggered, monitoring SL/TP
  placeOrder: (order: PendingOrder) => void
  cancelPendingOrder: () => void
  ```

- [ ] **Step 1: Replace useReplayEngine.ts with two-phase implementation**

Replace the entire file content with:

```ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OrderType = "MARKET" | "LIMIT" | "STOP";

export type PendingOrder = {
  direction: "LONG" | "SHORT";
  orderType: OrderType;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  placedAtIndex: number;
  entryBarIndex: number;
};

export type FilledTrade = {
  order: PendingOrder;
  entryBar: Bar;
  exitBar: Bar;
  exitPrice: number;
  outcome: "WIN" | "LOSS";
  rMultiple: number;
  pnlPoints: number;
};

type UseReplayEngineOpts = {
  onTradeFilled: (trade: FilledTrade) => void;
  onOrderActivated?: (order: PendingOrder, activationBar: Bar) => void;
};

const MIN_START_INDEX = 50;

export function useReplayEngine(
  bars: Bar[],
  { onTradeFilled, onOrderActivated }: UseReplayEngineOpts
) {
  const [currentIndex, setCurrentIndex] = useState(MIN_START_INDEX);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);
  const [activeOrder, setActiveOrder] = useState<PendingOrder | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOrderRef = useRef<PendingOrder | null>(null);
  const activeOrderRef = useRef<PendingOrder | null>(null);
  pendingOrderRef.current = pendingOrder;
  activeOrderRef.current = activeOrder;

  const onOrderActivatedRef = useRef(onOrderActivated);
  onOrderActivatedRef.current = onOrderActivated;

  const visibleBars = bars.slice(0, currentIndex + 1);
  const currentBar = bars[currentIndex] ?? null;

  useEffect(() => {
    setCurrentIndex(MIN_START_INDEX);
    setIsPlaying(false);
    setPendingOrder(null);
    setActiveOrder(null);
  }, [bars]);

  const checkOrderActivation = useCallback(
    (bar: Bar, index: number) => {
      const order = pendingOrderRef.current;
      if (!order || order.orderType === "MARKET") return;

      const { direction, orderType, entryPrice } = order;
      let activated = false;

      if (direction === "LONG") {
        activated = orderType === "LIMIT"
          ? bar.low <= entryPrice
          : bar.high >= entryPrice; // STOP
      } else {
        activated = orderType === "LIMIT"
          ? bar.high >= entryPrice
          : bar.low <= entryPrice; // STOP
      }

      if (!activated) return;

      const activatedOrder: PendingOrder = { ...order, entryBarIndex: index };
      setPendingOrder(null);
      setActiveOrder(activatedOrder);
      onOrderActivatedRef.current?.(activatedOrder, bar);
    },
    []
  );

  const checkOrderExit = useCallback(
    (bar: Bar) => {
      const order = activeOrderRef.current;
      if (!order) return;

      const { direction, entryPrice, stopLoss, takeProfit } = order;
      let exitPrice: number | null = null;
      let outcome: "WIN" | "LOSS" | null = null;

      if (direction === "LONG") {
        if (bar.low <= stopLoss) { exitPrice = stopLoss; outcome = "LOSS"; }
        else if (bar.high >= takeProfit) { exitPrice = takeProfit; outcome = "WIN"; }
      } else {
        if (bar.high >= stopLoss) { exitPrice = stopLoss; outcome = "LOSS"; }
        else if (bar.low <= takeProfit) { exitPrice = takeProfit; outcome = "WIN"; }
      }

      if (exitPrice === null || outcome === null) return;

      const risk = Math.abs(entryPrice - stopLoss);
      const rMultiple = direction === "LONG"
        ? (exitPrice - entryPrice) / risk
        : (entryPrice - exitPrice) / risk;
      const pnlPoints = direction === "LONG"
        ? exitPrice - entryPrice
        : entryPrice - exitPrice;

      const filled: FilledTrade = {
        order,
        entryBar: bars[order.entryBarIndex],
        exitBar: bar,
        exitPrice,
        outcome,
        rMultiple: Math.round(rMultiple * 100) / 100,
        pnlPoints: Math.round(pnlPoints * 10000) / 10000,
      };

      setActiveOrder(null);
      onTradeFilled(filled);
    },
    [bars, onTradeFilled]
  );

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, bars.length - 1);
      if (next !== prev) {
        checkOrderActivation(bars[next], next);
        checkOrderExit(bars[next]);
      }
      return next;
    });
  }, [bars, checkOrderActivation, checkOrderExit]);

  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, MIN_START_INDEX));
    setPendingOrder(null);
    setActiveOrder(null);
  }, []);

  const jumpTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(MIN_START_INDEX, Math.min(index, bars.length - 1)));
      setPendingOrder(null);
      setActiveOrder(null);
    },
    [bars.length]
  );

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const placeOrder = useCallback((order: PendingOrder) => {
    if (order.orderType === "MARKET") {
      setActiveOrder(order);
    } else {
      setPendingOrder(order);
    }
  }, []);

  const activateOrder = useCallback((order: PendingOrder) => {
    setPendingOrder(null);
    setActiveOrder(order);
  }, []);

  const cancelPendingOrder = useCallback(() => setPendingOrder(null), []);
  const cancelActiveOrder = useCallback(() => setActiveOrder(null), []);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(stepForward, Math.round(1000 / speed));
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, stepForward]);

  return {
    visibleBars,
    currentIndex,
    currentBar,
    isPlaying,
    speed,
    pendingOrder,
    activeOrder,
    play,
    pause,
    stepForward,
    stepBackward,
    jumpTo,
    setSpeed,
    placeOrder,
    activateOrder,
    cancelPendingOrder,
    cancelActiveOrder,
  };
}
```

- [ ] **Step 2: Build check**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npx tsc --noEmit 2>&1 | grep "useReplayEngine" | head -10
```

Expected: no errors on `useReplayEngine.ts` itself. `ReplayEngine.tsx` errors are expected until Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/useReplayEngine.ts
git commit -m "feat: two-phase order state (pendingOrder + activeOrder) with Limit/Stop activation"
```

---

## Task 4: ReplayEngine.tsx — inference, price line, toolbar, callbacks

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Interfaces:**
- Consumes:
  - `useReplayEngine` returns: `pendingOrder`, `activeOrder`, `placeOrder`, `cancelPendingOrder`, `activateOrder` (from Task 3)
  - `createReplayTrade(backtestId, TradeEntry): Promise<string>` — `TradeEntry` now has `orderType` (from Task 2)
  - `OrderType` type from `useReplayEngine.ts`
- Produces: Updated `ReplayEngine` component — no new exports

**Context for implementer:**

`ReplayEngine.tsx` is a large file (~1000 lines). The implementer must:

1. Add `inferOrderType` pure function near the top of the component file
2. Add a `pendingPriceLineRef` ref for the lightweight-charts price line
3. Add `handleOrderActivated` async callback for `onOrderActivated`
4. Update `handleEntryConfirm` — Market only creates DB record; Limit/Stop just calls `engine.placeOrder`
5. Manage price line creation/removal in a `useEffect` on `engine.pendingOrder`
6. Update toolbar to show inferred type badge and cancel button for pending orders
7. Update `engine.pendingOrder` references — the old `pendingOrder` (which was the active tracking order) is now `engine.activeOrder`

Key references in current file:
- `handleEntryConfirm` is at ~line 611
- Toolbar overlay badge is at ~line 765
- `engine.pendingOrder` used as guard for "order is active" at ~line 856 and ~line 958

- [ ] **Step 1: Add inferOrderType helper**

At the top of `ReplayEngine.tsx` (after imports, before the component function), add:

```ts
function inferOrderType(
  direction: "LONG" | "SHORT",
  entryPrice: number,
  currentClose: number
): "MARKET" | "LIMIT" | "STOP" {
  if (entryPrice === currentClose) return "MARKET";
  if (direction === "LONG") return entryPrice < currentClose ? "LIMIT" : "STOP";
  return entryPrice > currentClose ? "LIMIT" : "STOP";
}
```

- [ ] **Step 2: Add pendingPriceLineRef**

Inside the component, near the other refs (around line 190), add:

```ts
const pendingPriceLineRef = useRef<ReturnType<typeof seriesRef.current.createPriceLine> | null>(null);
```

Because `seriesRef.current` may not be typed precisely, use this pattern instead:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pendingPriceLineRef = useRef<any>(null);
```

- [ ] **Step 3: Manage price line lifecycle in useEffect**

Add a new `useEffect` after existing effects, dependent on `engine.pendingOrder`:

```ts
useEffect(() => {
  const series = seriesRef.current;
  if (!series) return;

  // Remove old price line
  if (pendingPriceLineRef.current) {
    try { series.removePriceLine(pendingPriceLineRef.current); } catch {}
    pendingPriceLineRef.current = null;
  }

  // Create new price line if there's a pending order
  if (engine.pendingOrder) {
    const { direction, orderType, entryPrice } = engine.pendingOrder;
    const label = `${orderType} ${direction} @ ${entryPrice.toFixed(5)}`;
    pendingPriceLineRef.current = series.createPriceLine({
      price: entryPrice,
      color: "#6366f1",
      lineWidth: 1,
      lineStyle: 2, // dashed (LineStyle.Dashed = 2 in lightweight-charts v5)
      axisLabelVisible: true,
      title: label,
    });
  }
}, [engine.pendingOrder]);
```

Also clean up in the chart cleanup useEffect (the one that calls `chart.remove()`), before `chart.remove()`:

```ts
if (pendingPriceLineRef.current && seriesRef.current) {
  try { seriesRef.current.removePriceLine(pendingPriceLineRef.current); } catch {}
  pendingPriceLineRef.current = null;
}
```

- [ ] **Step 4: Add handleOrderActivated callback**

After `handleExitSave`, add:

```ts
const handleOrderActivated = useCallback(
  async (order: PendingOrder, activationBar: Bar) => {
    // Limit/Stop triggered — now create the DB record
    try {
      const id = await createReplayTrade(backtestId, {
        direction:  order.direction,
        orderType:  order.orderType,
        entryPrice: order.entryPrice,
        stopLoss:   order.stopLoss,
        takeProfit: order.takeProfit,
        entryDate:  new Date(activationBar.time * 1000),
      });
      setActiveTradeId(id);
    } catch (err) {
      console.error("Failed to create trade on activation:", err);
    }
  },
  [backtestId]
);
```

Pass this to `useReplayEngine`:

```ts
const engine = useReplayEngine(bars, {
  onTradeFilled: handleTradeFilled,
  onOrderActivated: handleOrderActivated,
});
```

Note: `handleTradeFilled` uses `engineRef.current` to avoid circular dependency — keep that pattern unchanged. `handleOrderActivated` does not need `engine` so no circular dependency.

- [ ] **Step 5: Update handleEntryConfirm**

Replace the current `handleEntryConfirm` function body. For Market: create DB record immediately then `placeOrder`. For Limit/Stop: just `placeOrder` (DB created at activation by `handleOrderActivated`):

```ts
async function handleEntryConfirm() {
  if (!overlayState || !engine.currentBar) return;
  setIsSaving(true);
  try {
    const inferredType = inferOrderType(
      overlayState.direction,
      overlayState.entry,
      engine.currentBar.close
    );

    const order: PendingOrder = {
      direction:     overlayState.direction,
      orderType:     inferredType,
      entryPrice:    overlayState.entry,
      stopLoss:      overlayState.sl,
      takeProfit:    overlayState.tp,
      placedAtIndex: engine.currentIndex,
      entryBarIndex: engine.currentIndex, // for Market, placed = entry
    };

    if (inferredType === "MARKET") {
      const id = await createReplayTrade(backtestId, {
        direction:  overlayState.direction,
        orderType:  "MARKET",
        entryPrice: overlayState.entry,
        stopLoss:   overlayState.sl,
        takeProfit: overlayState.tp,
        entryDate:  new Date(engine.currentBar.time * 1000),
      });
      setActiveTradeId(id);
    }

    engine.placeOrder(order);
    overlayStateRef.current = null;
    setOverlayState(null);
    orderOverlayRef.current?.clear();
    if (overlayDivRef.current) overlayDivRef.current.style.pointerEvents = "none";
    setEntryModalOpen(false);
    engine.play();
  } finally {
    setIsSaving(false);
  }
}
```

- [ ] **Step 6: Update toolbar overlay badge**

Replace the `{overlayState && ( ... )}` block in the toolbar with one that shows the inferred order type. The current badge shows `E ... · SL ... · TP ...`. Update it to:

```tsx
{overlayState && (
  <>
    <span className="text-xs font-mono rounded px-1.5 py-0.5 font-bold"
      style={{ backgroundColor: "#312e81", color: "#a5b4fc" }}>
      {engine.currentBar
        ? `${inferOrderType(overlayState.direction, overlayState.entry, engine.currentBar.close)} ${overlayState.direction}`
        : overlayState.direction}
    </span>
    <span className="text-xs font-mono" style={{ color: "#6b7280" }}>
      E {overlayState.entry.toFixed(5)} · SL {overlayState.sl.toFixed(5)} · TP {overlayState.tp.toFixed(5)}
    </span>
    <button
      onClick={() => { engine.pause(); setEntryModalOpen(true); }}
      className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold"
      style={{ backgroundColor: "#6366f1", color: "#fff" }}
    >
      Confirm
    </button>
    <button
      onClick={() => {
        overlayStateRef.current = null;
        setOverlayState(null);
        orderOverlayRef.current?.clear();
        if (overlayDivRef.current) overlayDivRef.current.style.pointerEvents = "none";
      }}
      className="cursor-pointer flex h-5 w-5 items-center justify-center rounded"
      style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
    >
      <X size={11} />
    </button>
  </>
)}
```

Also add a pending-order indicator after the `{overlayState && ...}` block:

```tsx
{engine.pendingOrder && !overlayState && (
  <>
    <span className="text-xs font-mono rounded px-1.5 py-0.5 font-bold animate-pulse"
      style={{ backgroundColor: "#312e81", color: "#a5b4fc" }}>
      ⏳ {engine.pendingOrder.orderType} {engine.pendingOrder.direction} @ {engine.pendingOrder.entryPrice.toFixed(5)}
    </span>
    <button
      onClick={() => engine.cancelPendingOrder()}
      className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold"
      style={{ backgroundColor: "#374151", color: "#f87171" }}
    >
      Annuler l'ordre
    </button>
  </>
)}
```

- [ ] **Step 7: Fix engine.pendingOrder guards for "order is active"**

Search for all uses of `engine.pendingOrder` in `ReplayEngine.tsx` that act as a guard meaning "an order is being tracked" (e.g., `disabled={!!engine.pendingOrder}` on step/backward buttons). These should now check `engine.pendingOrder || engine.activeOrder`:

```tsx
// Old:
disabled={!!engine.pendingOrder}
// New:
disabled={!!engine.pendingOrder || !!engine.activeOrder}
```

Do this for every such guard. The showOrderPanel guard (`!engine.pendingOrder`) should also become `!engine.pendingOrder && !engine.activeOrder`.

- [ ] **Step 8: Full build check**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/ReplayEngine.tsx
git commit -m "feat: order type inference, pending price line, and two-phase confirm flow"
```

---

## Task 5: EntryConfirmModal — display order type

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/EntryConfirmModal.tsx`

**Interfaces:**
- Consumes: `overlayState: OrderOverlayState` (already a prop), `engine.currentBar.close` — the modal must receive the inferred type. The cleanest approach: pass `orderType: "MARKET" | "LIMIT" | "STOP"` as an explicit prop (computed in `ReplayEngine` before opening the modal).
- Produces: Updated modal props:
  ```ts
  type EntryConfirmModalProps = {
    overlayState: OrderOverlayState;
    entryBar: Bar;
    orderType: "MARKET" | "LIMIT" | "STOP";   // new
    onConfirm: () => void;
    onCancel: () => void;
    isSaving: boolean;
  };
  ```

- [ ] **Step 1: Read the current EntryConfirmModal**

Read `src/app/(app)/backtest/[id]/replay/EntryConfirmModal.tsx` to understand the current props and layout before editing.

- [ ] **Step 2: Add orderType prop and display it**

Add `orderType` to the props type. Add a row in the modal body displaying the order type before the Direction row:

```tsx
<div className="flex justify-between text-sm">
  <span style={{ color: "#9ca3af" }}>Type</span>
  <span className="font-bold rounded px-1.5 py-0.5"
    style={{ backgroundColor: "#312e81", color: "#a5b4fc" }}>
    {orderType} {overlayState.direction}
  </span>
</div>
```

For Market, this shows `MARKET LONG`. For Limit, `LIMIT LONG`. For Stop, `STOP SHORT`, etc.

- [ ] **Step 3: Update ReplayEngine to pass orderType to modal**

In `ReplayEngine.tsx`, add a state variable for the inferred type shown in the modal:

```ts
const [modalOrderType, setModalOrderType] = useState<"MARKET" | "LIMIT" | "STOP">("MARKET");
```

Before `setEntryModalOpen(true)` in the toolbar Confirm button handler:

```tsx
onClick={() => {
  if (engine.currentBar) {
    setModalOrderType(inferOrderType(overlayState!.direction, overlayState!.entry, engine.currentBar.close));
  }
  engine.pause();
  setEntryModalOpen(true);
}}
```

Pass it to the modal:

```tsx
{entryModalOpen && overlayState && engine.currentBar && (
  <EntryConfirmModal
    overlayState={overlayState}
    entryBar={engine.currentBar}
    orderType={modalOrderType}
    onConfirm={handleEntryConfirm}
    onCancel={() => setEntryModalOpen(false)}
    isSaving={isSaving}
  />
)}
```

- [ ] **Step 4: Build check**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/EntryConfirmModal.tsx \
        src/app/\(app\)/backtest/\[id\]/replay/ReplayEngine.tsx
git commit -m "feat: show order type in EntryConfirmModal"
```
