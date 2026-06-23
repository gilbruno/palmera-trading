# Replay Auto-Screenshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically capture a PNG screenshot of the replay chart (with entry/SL/TP price lines visible) when an order is confirmed, and upload it to Cloudflare R2 via the existing `/api/upload` endpoint, creating a `BacktestTradeMedia` record linked to the trade.

**Architecture:** `chart.takeScreenshot()` returns an `HTMLCanvasElement` synchronously — call `.toBlob()` to get a PNG blob, POST it to `/api/upload?type=backtest` with the `tradeId`, and the endpoint creates the `BacktestTradeMedia` row. The capture happens client-side in `ReplayEngine.tsx` at two injection points: after `createReplayTrade` in `handleEntryConfirm` (MARKET orders) and after `createReplayTrade` in `handleOrderActivated` (Limit/Stop activation). The upload is fire-and-forget — errors are logged but do not block the trade flow.

**Tech Stack:** lightweight-charts v5 `IChartApi.takeScreenshot()`, browser Canvas API `toBlob()`, `fetch` POST multipart to `/api/upload`, existing `BacktestTradeMedia` Prisma model.

## Global Constraints

- No new npm packages
- No DB migration — `BacktestTradeMedia` and its relation to `BacktestTrade` already exist
- Upload endpoint: `POST /api/upload` with `multipart/form-data` fields: `file` (PNG File), `tradeId` (string), `type` = `"backtest"`
- Upload is fire-and-forget: `await` the upload but catch errors silently (console.error only) — never throw or block the trade confirmation flow
- Screenshot must be taken AFTER `createReplayTrade` returns (so `tradeId` is available) and BEFORE `engine.placeOrder` / `engine.play()` (so price lines are still visible)
- `chartRef.current` is typed as `IChartApi | null`; `IChartApi.takeScreenshot()` returns `HTMLCanvasElement`
- Only one file to modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

---

### Task 1: Add `captureAndUploadScreenshot` helper + wire into MARKET and Limit/Stop flows

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Interfaces:**
- Consumes: `chartRef` (already exists, `useRef<IChartApi | null>(null)`)
- `handleEntryConfirm`: already calls `createReplayTrade` and gets back `id: string` — inject screenshot capture after this line
- `handleOrderActivated`: already calls `createReplayTrade` and gets back `id: string` — inject screenshot capture after this line
- `OrderPanel onConfirm` path (around line 1624): also calls `createReplayTrade` and gets `id` — inject screenshot capture there too

- [ ] **Step 1: Add the `captureAndUploadScreenshot` helper function**

Add this function inside the `ReplayEngine` component body, just before `handleEntryConfirm`. It is `async` but callers use `void captureAndUploadScreenshot(id)` (fire-and-forget):

```ts
async function captureAndUploadScreenshot(tradeId: string): Promise<void> {
  const chart = chartRef.current;
  if (!chart) return;
  try {
    const canvas = chart.takeScreenshot();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return;
    const file = new File([blob], `replay-${tradeId}.png`, { type: "image/png" });
    const form = new FormData();
    form.append("file", file);
    form.append("tradeId", tradeId);
    form.append("type", "backtest");
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) {
      console.error("[replay] screenshot upload failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[replay] screenshot capture error:", err);
  }
}
```

- [ ] **Step 2: Wire into `handleEntryConfirm` — MARKET path**

In `handleEntryConfirm`, the MARKET branch currently looks like this (around line 1093):

```ts
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
```

Add the screenshot call immediately after `setActiveTradeId(id)`, still inside the `if (inferredType === "MARKET")` block:

```ts
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
  void captureAndUploadScreenshot(id);
}
```

- [ ] **Step 3: Wire into `handleOrderActivated` — Limit/Stop activation path**

`handleOrderActivated` (around line 249) currently ends with:

```ts
const id = await createReplayTrade(backtestId, { ... });
setActiveTradeId(id);
```

Add screenshot call after `setActiveTradeId(id)`:

```ts
const id = await createReplayTrade(backtestId, {
  direction:  order.direction,
  orderType:  order.orderType,
  entryPrice: order.entryPrice,
  stopLoss:   order.stopLoss,
  takeProfit: order.takeProfit,
  entryDate:  new Date(activationBar.time * 1000),
});
setActiveTradeId(id);
void captureAndUploadScreenshot(id);
```

- [ ] **Step 4: Wire into `OrderPanel onConfirm` — MARKET path via OrderPanel**

The `OrderPanel onConfirm` callback (around line 1624) has a MARKET branch that calls `createReplayTrade`:

```ts
const id = await createReplayTrade(backtestId, {
  direction:  correctedOrder.direction,
  orderType:  "MARKET",
  entryPrice: correctedOrder.entryPrice,
  stopLoss:   correctedOrder.stopLoss,
  takeProfit: correctedOrder.takeProfit,
  entryDate:  new Date(engine.currentBar.time * 1000),
});
setActiveTradeId(id);
```

Add screenshot call after `setActiveTradeId(id)`:

```ts
setActiveTradeId(id);
void captureAndUploadScreenshot(id);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1 | grep -E "ReplayEngine\.tsx|error" | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/ReplayEngine.tsx
git commit -m "feat(replay): auto-capture chart screenshot on order confirm and upload to R2"
```

---

## Manual Testing Checklist

- [ ] Place a MARKET order via the overlay → confirm → check browser Network tab: `POST /api/upload` fires with status 201
- [ ] Check Prisma Studio or DB: `backtest_trade_media` row created with correct `tradeId`, non-empty `url` pointing to R2
- [ ] Place a LIMIT order (entry below current price) → confirm → replay continues until price reaches entry → `POST /api/upload` fires at activation moment
- [ ] Place a MARKET order via OrderPanel → confirm → `POST /api/upload` fires
- [ ] If R2 is unavailable (offline): console.error logged, trade confirmation flow still completes normally (no throw, no blocking UI)
