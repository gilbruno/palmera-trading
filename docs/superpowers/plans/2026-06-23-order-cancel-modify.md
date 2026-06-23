# Order Cancel & Modify SL/TP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow cancelling a pending order (entry not yet triggered) and modifying SL/TP on both pending and active orders via draggable DOM overlays on price lines, with a confirmation mini-panel before DB update.

**Architecture:** DOM divs positioned absolutely over the chart track price line coordinates frame-by-frame via `requestAnimationFrame`. Drag is captured with pointer events (same pattern as the existing OrderOverlay). A React state `pendingModification` holds a draft SL or TP before the user confirms. The Server Action `updateOrderLevels` updates only `stopLoss`/`takeProfit` in DB. For active orders, `useReplayEngine` exposes `updateActiveOrderLevels(sl, tp)` so the engine uses the new values on the next tick.

**Tech Stack:** React 19, lightweight-charts v5, Prisma, Next.js 15 Server Actions, TypeScript

## Global Constraints

- All price values persisted via `Math.round(n * 100) / 100` (2 decimal places, already enforced in `actions.ts`)
- lightweight-charts price lines are visual only — drag is implemented via DOM overlay divs, not via the library
- Cancel is only available when `engine.pendingOrder !== null` (entry not triggered)
- TP drag is available for both `engine.pendingOrder` and `engine.activeOrder`
- SL drag is only available for `engine.pendingOrder` (not once active — trade is in progress)
- No new npm packages
- Files live in `src/app/(app)/backtest/[id]/replay/`

---

### Task 1: Server Action — `updateOrderLevels`

Add a new Server Action to update SL and/or TP on an existing `BacktestTrade`.

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/actions.ts`

**Interfaces:**
- Produces: `updateOrderLevels(tradeId: string, sl: number, tp: number): Promise<void>` — exported, used by Task 3

- [ ] **Step 1: Add the function to `actions.ts`**

Add after the existing `updateReplayTrade` function:

```ts
export async function updateOrderLevels(
  tradeId: string,
  sl: number,
  tp: number
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const trade = await prisma.backtestTrade.findUnique({
    where: { id: tradeId },
    select: { backtestId: true, backtest: { select: { userId: true } } },
  });
  if (!trade || trade.backtest.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.backtestTrade.update({
    where: { id: tradeId },
    data: { stopLoss: r2(sl), takeProfit: r2(tp) },
  });

  revalidatePath(`/backtest/${trade.backtestId}`);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1 | grep -E "actions\.ts|error" | head -20
```

Expected: no errors on `actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/actions.ts
git commit -m "feat(replay): add updateOrderLevels server action"
```

---

### Task 2: Engine — `updateActiveOrderLevels` in `useReplayEngine`

Expose a way to update SL and TP on the active order so `checkOrderExit` uses the new values on the next bar tick.

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/useReplayEngine.ts`

**Interfaces:**
- Consumes: existing `activeOrder: PendingOrder | null`, `setActiveOrder`
- Produces: `updateActiveOrderLevels(sl: number, tp: number): void` — added to the return object of `useReplayEngine`

- [ ] **Step 1: Add the function inside `useReplayEngine`, before the return statement**

```ts
const updateActiveOrderLevels = useCallback((sl: number, tp: number) => {
  setActiveOrder((prev) => {
    if (!prev) return prev;
    const updated = { ...prev, stopLoss: sl, takeProfit: tp };
    activeOrderRef.current = updated;
    return updated;
  });
}, []);
```

- [ ] **Step 2: Add to the return object**

In the `return { ... }` block at the end of `useReplayEngine`, add:

```ts
updateActiveOrderLevels,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1 | grep -E "useReplayEngine\.ts|error" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/useReplayEngine.ts
git commit -m "feat(replay): expose updateActiveOrderLevels in engine"
```

---

### Task 3: UI — Cancel button + SL/TP drag overlays + confirmation panel

This is the main UI task. All logic lives in `ReplayEngine.tsx`.

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Interfaces:**
- Consumes:
  - `engine.pendingOrder: PendingOrder | null`
  - `engine.activeOrder: PendingOrder | null`
  - `engine.cancelPendingOrder(): void`
  - `engine.updateActiveOrderLevels(sl: number, tp: number): void` (from Task 2)
  - `activeTradeId: string | null` (existing state)
  - `updateOrderLevels(tradeId, sl, tp)` from `actions.ts` (Task 1)
  - `slPriceLineRef`, `tpPriceLineRef`, `activeSlPriceLineRef`, `activeTpPriceLineRef`, `pendingPriceLineRef` (existing refs)
  - `seriesRef`, `chartRef` (existing refs)

**New state and refs to add in `ReplayEngine`:**

```ts
// Tracks which level is being dragged and its draft value
type DragModify = { target: "sl" | "tp"; originalValue: number; draftValue: number } | null;
const [dragModify, setDragModify] = useState<DragModify>(null);
const dragModifyRef = useRef<DragModify>(null);

// Pending confirmation after drag ends
type PendingModification = { target: "sl" | "tp"; oldValue: number; newValue: number } | null;
const [pendingModification, setPendingModification] = useState<PendingModification>(null);

// rAF loop handle for repositioning DOM overlays
const overlayRafRef = useRef<number | null>(null);

// DOM refs for the floating overlays
const cancelBtnRef = useRef<HTMLDivElement>(null);
const slHandleRef  = useRef<HTMLDivElement>(null);
const tpHandleRef  = useRef<HTMLDivElement>(null);
```

- [ ] **Step 1: Add imports and new state/refs**

At the top of `ReplayEngine.tsx`, add to the existing import from `./actions`:

```ts
import { createReplayTrade, updateReplayTrade, updateOrderLevels } from "./actions";
```

Add the new state variables and refs listed above inside the `ReplayEngine` component, after the existing `pendingPriceLineRef` block.

- [ ] **Step 2: Add the rAF loop that repositions DOM overlay divs**

Add this `useEffect` after the existing price line effects. It runs continuously when there is a pending or active order, positioning 3 DOM divs (cancel button on entry line, SL handle, TP handle):

```ts
// rAF loop: reposition DOM overlays to track price lines
useEffect(() => {
  const container = chartContainerRef.current;
  if (!container || (!engine.pendingOrder && !engine.activeOrder)) {
    if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current);
    // Hide all overlays
    if (cancelBtnRef.current)  cancelBtnRef.current.style.display  = "none";
    if (slHandleRef.current)   slHandleRef.current.style.display   = "none";
    if (tpHandleRef.current)   tpHandleRef.current.style.display   = "none";
    return;
  }

  const order = engine.pendingOrder ?? engine.activeOrder!;
  const series = seriesRef.current;
  if (!series) return;

  const tick = () => {
    const slY  = series.priceToCoordinate(order.stopLoss);
    const tpY  = series.priceToCoordinate(order.takeProfit);
    const entY = engine.pendingOrder
      ? series.priceToCoordinate(order.entryPrice)
      : null;

    // Cancel button: only when pending, positioned on entry line right side
    if (cancelBtnRef.current) {
      if (engine.pendingOrder && entY !== null) {
        const w = container.clientWidth;
        cancelBtnRef.current.style.display = "flex";
        cancelBtnRef.current.style.top  = `${entY - 10}px`;
        cancelBtnRef.current.style.left = `${w - 90}px`;
      } else {
        cancelBtnRef.current.style.display = "none";
      }
    }

    // SL handle: only when pending
    if (slHandleRef.current) {
      if (engine.pendingOrder && slY !== null) {
        slHandleRef.current.style.display = "flex";
        slHandleRef.current.style.top  = `${slY - 10}px`;
        slHandleRef.current.style.left = "4px";
      } else {
        slHandleRef.current.style.display = "none";
      }
    }

    // TP handle: pending or active
    if (tpHandleRef.current) {
      if (tpY !== null) {
        tpHandleRef.current.style.display = "flex";
        tpHandleRef.current.style.top  = `${tpY - 10}px`;
        tpHandleRef.current.style.left = "4px";
      } else {
        tpHandleRef.current.style.display = "none";
      }
    }

    overlayRafRef.current = requestAnimationFrame(tick);
  };

  overlayRafRef.current = requestAnimationFrame(tick);

  return () => {
    if (overlayRafRef.current) cancelAnimationFrame(overlayRafRef.current);
  };
}, [engine.pendingOrder, engine.activeOrder]);
```

- [ ] **Step 3: Add pointer-drag logic for SL and TP handles**

Add this `useEffect` (runs once at mount, like the chart pointer handlers):

```ts
// Drag handlers for SL/TP handles — added inside the chart init useEffect
// (Place these lines INSIDE the existing chart init useEffect, just before the return cleanup)
```

Actually, to avoid coupling to the chart init effect, add a **separate** `useEffect` that runs once:

```ts
useEffect(() => {
  const container = chartContainerRef.current;
  if (!container) return;

  const onSlPointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const order = engine.pendingOrder ?? engine.activeOrder;
    if (!order) return;
    dragModifyRef.current = { target: "sl", originalValue: order.stopLoss, draftValue: order.stopLoss };
    setDragModify({ ...dragModifyRef.current });
    slHandleRef.current?.setPointerCapture(e.pointerId);
  };

  const onTpPointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const order = engine.pendingOrder ?? engine.activeOrder;
    if (!order) return;
    dragModifyRef.current = { target: "tp", originalValue: order.takeProfit, draftValue: order.takeProfit };
    setDragModify({ ...dragModifyRef.current });
    tpHandleRef.current?.setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: PointerEvent) => {
    const dm = dragModifyRef.current;
    if (!dm || !seriesRef.current) return;
    e.stopPropagation();
    const r = container.getBoundingClientRect();
    const price = seriesRef.current.coordinateToPrice(e.clientY - r.top);
    if (price == null) return;
    dragModifyRef.current = { ...dm, draftValue: price };
    setDragModify({ ...dragModifyRef.current });
  };

  const onHandlePointerUp = (e: PointerEvent) => {
    const dm = dragModifyRef.current;
    if (!dm) return;
    e.stopPropagation();
    dragModifyRef.current = null;
    setDragModify(null);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    setPendingModification({
      target: dm.target,
      oldValue: r2(dm.originalValue),
      newValue: r2(dm.draftValue),
    });
  };

  const sl = slHandleRef.current;
  const tp = tpHandleRef.current;
  sl?.addEventListener("pointerdown", onSlPointerDown);
  tp?.addEventListener("pointerdown", onTpPointerDown);
  sl?.addEventListener("pointermove", onHandlePointerMove);
  tp?.addEventListener("pointermove", onHandlePointerMove);
  sl?.addEventListener("pointerup", onHandlePointerUp);
  tp?.addEventListener("pointerup", onHandlePointerUp);

  return () => {
    sl?.removeEventListener("pointerdown", onSlPointerDown);
    tp?.removeEventListener("pointerdown", onTpPointerDown);
    sl?.removeEventListener("pointermove", onHandlePointerMove);
    tp?.removeEventListener("pointermove", onHandlePointerMove);
    sl?.removeEventListener("pointerup", onHandlePointerUp);
    tp?.removeEventListener("pointerup", onHandlePointerUp);
  };
}, []); // refs are stable — no deps needed
```

**Note:** The `engine.pendingOrder` / `engine.activeOrder` references inside the pointer handlers are stale closures. Read current order from refs instead. Add these two lines near the other refs:

```ts
const pendingOrderSnapshot = useRef<PendingOrder | null>(null);
const activeOrderSnapshot  = useRef<PendingOrder | null>(null);
```

And keep them synced:

```ts
pendingOrderSnapshot.current = engine.pendingOrder;
activeOrderSnapshot.current  = engine.activeOrder;
```

Then replace `engine.pendingOrder ?? engine.activeOrder` in the pointer handlers with `pendingOrderSnapshot.current ?? activeOrderSnapshot.current`.

- [ ] **Step 4: Add live price line update during drag**

In the pending price line `useEffect([engine.pendingOrder])` and active price line `useEffect([engine.activeOrder])`, the price lines are recreated when state changes. During drag, `dragModify` holds the draft value — use it to visually move the price line in real time.

Add a new `useEffect` that responds to `dragModify`:

```ts
useEffect(() => {
  const series = seriesRef.current;
  if (!series || !dragModify) return;

  // Temporarily update the visual price line to the draft position
  if (dragModify.target === "sl") {
    if (slPriceLineRef.current) {
      try { series.removePriceLine(slPriceLineRef.current); } catch {}
    }
    slPriceLineRef.current = series.createPriceLine({
      price: dragModify.draftValue,
      color: "#ef4444",
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `SL @ ${dragModify.draftValue.toFixed(5)}`,
    });
    if (activeSlPriceLineRef.current) {
      try { series.removePriceLine(activeSlPriceLineRef.current); } catch {}
      activeSlPriceLineRef.current = series.createPriceLine({
        price: dragModify.draftValue,
        color: "#ef4444",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `SL @ ${dragModify.draftValue.toFixed(5)}`,
      });
    }
  } else {
    if (tpPriceLineRef.current) {
      try { series.removePriceLine(tpPriceLineRef.current); } catch {}
    }
    tpPriceLineRef.current = series.createPriceLine({
      price: dragModify.draftValue,
      color: "#22c55e",
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `TP @ ${dragModify.draftValue.toFixed(5)}`,
    });
    if (activeTpPriceLineRef.current) {
      try { series.removePriceLine(activeTpPriceLineRef.current); } catch {}
      activeTpPriceLineRef.current = series.createPriceLine({
        price: dragModify.draftValue,
        color: "#22c55e",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `TP @ ${dragModify.draftValue.toFixed(5)}`,
      });
    }
  }
}, [dragModify]);
```

- [ ] **Step 5: Add `handleConfirmModification` async function**

Add this function in `ReplayEngine`, alongside `handleEntryConfirm` and `handleExitSave`:

```ts
async function handleConfirmModification() {
  if (!pendingModification || !activeTradeId) return;
  const order = pendingOrderSnapshot.current ?? activeOrderSnapshot.current;
  if (!order) return;

  const newSl = pendingModification.target === "sl"
    ? pendingModification.newValue
    : order.stopLoss;
  const newTp = pendingModification.target === "tp"
    ? pendingModification.newValue
    : order.takeProfit;

  setIsSaving(true);
  try {
    await updateOrderLevels(activeTradeId, newSl, newTp);
    // Update engine for active orders so checkOrderExit uses new values
    if (activeOrderSnapshot.current) {
      engine.updateActiveOrderLevels(newSl, newTp);
    }
    // For pending orders the pendingOrder state will be refreshed by the activation flow
    setPendingModification(null);
  } finally {
    setIsSaving(false);
  }
}

function handleCancelModification() {
  // Re-trigger price line effects by forcing a no-op state update
  // The existing useEffect([engine.pendingOrder]) and useEffect([engine.activeOrder])
  // will restore the correct price lines on next render via their cleanup
  setPendingModification(null);
  // Force price line refresh: temporarily null then restore handled by the effects
  // Actually, just trigger a re-render — the useEffect deps haven't changed, so
  // we need to nudge it. Simplest: remove and re-add lines directly.
  const series = seriesRef.current;
  if (!series) return;
  const order = pendingOrderSnapshot.current ?? activeOrderSnapshot.current;
  if (!order) return;
  // Restore SL line
  if (slPriceLineRef.current) {
    try { series.removePriceLine(slPriceLineRef.current); } catch {}
  }
  slPriceLineRef.current = series.createPriceLine({
    price: order.stopLoss,
    color: "#ef4444", lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
    title: `SL @ ${order.stopLoss.toFixed(5)}`,
  });
  if (activeSlPriceLineRef.current) {
    try { series.removePriceLine(activeSlPriceLineRef.current); } catch {}
    activeSlPriceLineRef.current = series.createPriceLine({
      price: order.stopLoss,
      color: "#ef4444", lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
      title: `SL @ ${order.stopLoss.toFixed(5)}`,
    });
  }
  // Restore TP line
  if (tpPriceLineRef.current) {
    try { series.removePriceLine(tpPriceLineRef.current); } catch {}
  }
  tpPriceLineRef.current = series.createPriceLine({
    price: order.takeProfit,
    color: "#22c55e", lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
    title: `TP @ ${order.takeProfit.toFixed(5)}`,
  });
  if (activeTpPriceLineRef.current) {
    try { series.removePriceLine(activeTpPriceLineRef.current); } catch {}
    activeTpPriceLineRef.current = series.createPriceLine({
      price: order.takeProfit,
      color: "#22c55e", lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
      title: `TP @ ${order.takeProfit.toFixed(5)}`,
    });
  }
}
```

- [ ] **Step 6: Add the 3 DOM overlay divs and confirmation panel to JSX**

Inside the `<div className="relative min-h-0 flex-1">` block (the chart container div), add after the existing TF loader overlay and OHLC display:

```tsx
{/* Cancel order button — floats over entry price line, pending only */}
<div
  ref={cancelBtnRef}
  style={{
    display: "none",
    position: "absolute",
    zIndex: 15,
    alignItems: "center",
    gap: "4px",
    backgroundColor: "#1f2937",
    border: "1px solid #ef4444",
    borderRadius: "4px",
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: "11px",
    color: "#f87171",
    userSelect: "none",
    pointerEvents: "all",
  }}
  onClick={() => engine.cancelPendingOrder()}
>
  <X size={10} /> Annuler
</div>

{/* SL drag handle — floats over SL price line, pending only */}
<div
  ref={slHandleRef}
  style={{
    display: "none",
    position: "absolute",
    zIndex: 15,
    width: "20px",
    height: "20px",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    borderRadius: "3px",
    cursor: "ns-resize",
    touchAction: "none",
    pointerEvents: "all",
  }}
>
  <span style={{ color: "#fff", fontSize: "9px", lineHeight: 1, userSelect: "none" }}>⠿</span>
</div>

{/* TP drag handle — floats over TP price line, pending or active */}
<div
  ref={tpHandleRef}
  style={{
    display: "none",
    position: "absolute",
    zIndex: 15,
    width: "20px",
    height: "20px",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
    borderRadius: "3px",
    cursor: "ns-resize",
    touchAction: "none",
    pointerEvents: "all",
  }}
>
  <span style={{ color: "#fff", fontSize: "9px", lineHeight: 1, userSelect: "none" }}>⠿</span>
</div>

{/* Modification confirmation mini-panel */}
{pendingModification && (() => {
  const order = pendingOrderSnapshot.current ?? activeOrderSnapshot.current;
  if (!order) return null;
  const newSl = pendingModification.target === "sl" ? pendingModification.newValue : order.stopLoss;
  const newTp = pendingModification.target === "tp" ? pendingModification.newValue : order.takeProfit;
  const risk   = Math.abs(order.entryPrice - newSl);
  const reward = Math.abs(order.entryPrice - newTp);
  const rr     = risk > 0 ? (reward / risk).toFixed(2) : "—";
  const label  = pendingModification.target === "sl" ? "SL" : "TP";
  return (
    <div
      style={{
        position: "absolute",
        bottom: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        backgroundColor: "#111827",
        border: "1px solid #374151",
        borderRadius: "8px",
        padding: "12px 16px",
        minWidth: "240px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        pointerEvents: "all",
      }}
    >
      <div style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Modifier {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px", fontFamily: "ui-monospace, monospace", fontSize: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7280" }}>Ancien</span>
          <span style={{ color: "#d1d5db" }}>{pendingModification.oldValue.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7280" }}>Nouveau</span>
          <span style={{ color: pendingModification.target === "sl" ? "#f87171" : "#4ade80" }}>
            {pendingModification.newValue.toFixed(2)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #1f2937", paddingTop: "4px", marginTop: "4px" }}>
          <span style={{ color: "#6b7280" }}>Nouveau R/R</span>
          <span style={{ color: "#a5b4fc", fontWeight: "bold" }}>{rr}R</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleConfirmModification}
          disabled={isSaving}
          style={{
            flex: 1,
            padding: "6px 0",
            backgroundColor: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "bold",
            cursor: isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? "…" : "Confirmer"}
        </button>
        <button
          onClick={handleCancelModification}
          disabled={isSaving}
          style={{
            flex: 1,
            padding: "6px 0",
            backgroundColor: "#1f2937",
            color: "#9ca3af",
            border: "1px solid #374151",
            borderRadius: "6px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
})()}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1 | grep -E "ReplayEngine\.tsx|error" | head -30
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/ReplayEngine.tsx
git commit -m "feat(replay): cancel pending order + drag SL/TP with confirmation panel"
```

---

### Task 4: Engine — `updatePendingOrderLevels` for pending orders

When `pendingModification` is confirmed for a **pending** order, the engine's `pendingOrder` state must also reflect the new SL/TP so `checkOrderActivation` exit logic uses correct values.

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/useReplayEngine.ts`

**Interfaces:**
- Produces: `updatePendingOrderLevels(sl: number, tp: number): void` — added to the return object

- [ ] **Step 1: Add the function inside `useReplayEngine`**

```ts
const updatePendingOrderLevels = useCallback((sl: number, tp: number) => {
  setPendingOrder((prev) => {
    if (!prev) return prev;
    const updated = { ...prev, stopLoss: sl, takeProfit: tp };
    pendingOrderRef.current = updated;
    return updated;
  });
}, []);
```

- [ ] **Step 2: Add to the return object**

```ts
updatePendingOrderLevels,
```

- [ ] **Step 3: Update `handleConfirmModification` in `ReplayEngine.tsx` to call it**

In the `handleConfirmModification` function (added in Task 3 Step 5), add the pending order case. Replace the comment `// For pending orders the pendingOrder state will be refreshed by the activation flow` with:

```ts
if (pendingOrderSnapshot.current) {
  engine.updatePendingOrderLevels(newSl, newTp);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1 | grep -E "useReplayEngine\.ts|ReplayEngine\.tsx|error" | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/useReplayEngine.ts \
        src/app/\(app\)/backtest/\[id\]/replay/ReplayEngine.tsx
git commit -m "feat(replay): updatePendingOrderLevels — keep engine in sync on SL/TP modify"
```

---

## Manual Testing Checklist

After all tasks are complete, verify end-to-end in the browser:

**Cancel pending order:**
- [ ] Place a LONG order with entry above current price (STOP) → click Confirm → order is pending
- [ ] Cancel button (✕ Annuler) appears on the entry price line
- [ ] Click cancel → all 3 price lines disappear, engine.pendingOrder = null, no DB entry created
- [ ] Replay resumes normally

**Modify SL on pending order:**
- [ ] Place a pending LIMIT order → see SL (red) handle on left side of chart
- [ ] Drag SL handle up/down → price line moves in real time
- [ ] Release → mini-panel shows "Modifier SL / Ancien: X / Nouveau: Y / Nouveau R/R: Z"
- [ ] Click Confirmer → DB updated, price line at new position, mini-panel gone
- [ ] Click Annuler → price line snaps back to original

**Modify TP on pending order:**
- [ ] Same flow for TP (green handle) → DB updated

**Modify TP on active order:**
- [ ] Replay continues past entry price → order activates (SL/TP lines remain)
- [ ] TP (green handle) is still draggable
- [ ] Drag → mini-panel → Confirmer → DB updated + engine checkOrderExit uses new TP
- [ ] SL handle is gone (not draggable on active order)

**Cancel not available on active order:**
- [ ] No cancel button visible once order is active
