# Replay Engine v2 — Timeline Fix + TF Selector + Indicators

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the missing time scale, add a timeframe switcher, and add VWAP Anchored, IB Range, and ICT Sessions indicators to the replay chart.

**Architecture:** All computation is client-side in memory. `indicators.ts` exports pure functions. `ReplayEngine.tsx` wires them to lightweight-charts v5 using `createPriceLine` for IB levels, `addSeries(LineSeries)` for VWAP, and `IPanePrimitive` canvas rectangles for sessions.

**Tech Stack:** lightweight-charts v5.2.0, Next.js 15 App Router, React 19, TypeScript, `useSearchParams` + `useRouter` for TF switching.

## Global Constraints

- `"use client"` on ReplayEngine.tsx
- No new API routes, no new DB queries
- CSS vars for UI chrome; hardcoded only: `#6366f1` (indigo), `#22c55e` (green), `#ef4444` (red), `#a78bfa` (purple/VWAP)
- lightweight-charts v5 API: `addSeries(CandlestickSeries)`, `addSeries(LineSeries)`, `series.createPriceLine()`, `chart.panes()[0].attachPrimitive()`
- No git commits (developer commits manually)
- Preserve existing playback controls, OrderPanel, TradeResultModal, createReplayTrade

## File Map

- **Create:** `src/app/(app)/backtest/[id]/replay/indicators.ts` — pure functions for VWAP, IB Range, session bands
- **Modify:** `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx` — fix layout, add TF selector, wire indicators
- **Modify:** `src/app/(app)/backtest/[id]/replay/page.tsx` — pass `tf` prop to ReplayEngine

---

### Task 1: `indicators.ts` — Pure computation functions

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/indicators.ts`

**Interfaces:**
- Consumes: `Bar` type from `./useReplayEngine`
- Produces:
  - `calcVwap(bars: Bar[], anchorIndex: number): number[]` — array of VWAP values, index-aligned with `bars`, `NaN` before anchor
  - `calcIBRange(bars: Bar[]): { high: number; low: number } | null` — IB of the last calendar day present in bars (13:30–14:30 UTC, DST-aware)
  - `getSessionBands(bars: Bar[]): SessionBand[]` — all session rectangles visible in bars range
  - `type SessionBand = { label: string; color: string; openTime: number; closeTime: number }` — times in Unix **seconds** UTC

- [ ] **Step 1: Create the file with types and DST helper**

```typescript
// src/app/(app)/backtest/[id]/replay/indicators.ts
import type { Bar } from "./useReplayEngine";

export type SessionBand = {
  label: string;
  color: string;
  openTime: number;  // Unix seconds UTC
  closeTime: number; // Unix seconds UTC
};

// Returns true if the given UTC date is in US EDT (summer time)
// EDT runs from 2nd Sunday in March to 1st Sunday in November
function isUSEDT(date: Date): boolean {
  const year = date.getUTCFullYear();

  // 2nd Sunday in March
  const mar = new Date(Date.UTC(year, 2, 1));
  const marDay = mar.getUTCDay(); // 0=Sun
  const dstStart = new Date(Date.UTC(year, 2, 8 + ((7 - marDay) % 7)));

  // 1st Sunday in November
  const nov = new Date(Date.UTC(year, 10, 1));
  const novDay = nov.getUTCDay();
  const dstEnd = new Date(Date.UTC(year, 10, 1 + ((7 - novDay) % 7)));

  return date >= dstStart && date < dstEnd;
}

// Returns NY session open/close times in UTC seconds for a given UTC calendar date (YYYY-MM-DD)
// Sessions defined in ET, converted to UTC accounting for DST
function sessionTimesUTC(dateStr: string): {
  asia: [number, number];
  london: [number, number];
  nyAm: [number, number];
  nyPm: [number, number];
} {
  const base = new Date(dateStr + "T00:00:00Z");
  const prevDay = new Date(base.getTime() - 86400 * 1000);
  const prevStr = prevDay.toISOString().slice(0, 10);

  // ET offset: EST = UTC-5, EDT = UTC-4
  const etOffsetHours = isUSEDT(base) ? 4 : 5;

  // Asia: 18:00–00:00 ET previous day → UTC
  // = (18 + etOffset):00 prev day UTC to (24 + etOffset):00 prev day UTC
  const asiaOpen = new Date(prevStr + `T${String(18 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;
  const asiaClose = new Date(dateStr + `T${String(0 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;

  // London: 02:00–05:00 UTC (fixed, not ET-based)
  const londonOpen  = new Date(dateStr + "T02:00:00Z").getTime() / 1000;
  const londonClose = new Date(dateStr + "T05:00:00Z").getTime() / 1000;

  // NY AM: 09:30–12:00 ET = (9.5 + etOffset):00–(12 + etOffset):00 UTC
  const nyAmOpen  = new Date(dateStr + `T${String(9 + etOffsetHours).padStart(2,"0")}:30:00Z`).getTime() / 1000;
  const nyAmClose = new Date(dateStr + `T${String(12 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;

  // NY PM: 13:00–16:00 ET = (13 + etOffset):00–(16 + etOffset):00 UTC
  const nyPmOpen  = new Date(dateStr + `T${String(13 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;
  const nyPmClose = new Date(dateStr + `T${String(16 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;

  return {
    asia:   [asiaOpen,  asiaClose],
    london: [londonOpen, londonClose],
    nyAm:   [nyAmOpen,  nyAmClose],
    nyPm:   [nyPmOpen,  nyPmClose],
  };
}
```

- [ ] **Step 2: Implement `getSessionBands`**

```typescript
export function getSessionBands(bars: Bar[]): SessionBand[] {
  if (bars.length === 0) return [];

  const firstTime = bars[0].time;
  const lastTime  = bars[bars.length - 1].time;

  // Collect unique calendar dates (UTC) covered by bars
  const dates = new Set<string>();
  for (const bar of bars) {
    dates.add(new Date(bar.time * 1000).toISOString().slice(0, 10));
  }
  // Also include prev day for Asia session
  const allDates = new Set<string>();
  for (const d of dates) {
    allDates.add(d);
    const prev = new Date(new Date(d).getTime() + 86400 * 1000).toISOString().slice(0, 10);
    allDates.add(prev);
  }

  const bands: SessionBand[] = [];

  for (const dateStr of Array.from(allDates).sort()) {
    const { asia, london, nyAm, nyPm } = sessionTimesUTC(dateStr);

    const sessions = [
      { label: "Asia",  color: "rgba(148,163,184,0.07)", times: asia   },
      { label: "London",color: "rgba(59,130,246,0.09)",  times: london },
      { label: "NY AM", color: "rgba(34,197,94,0.09)",   times: nyAm   },
      { label: "NY PM", color: "rgba(249,115,22,0.09)",  times: nyPm   },
    ];

    for (const s of sessions) {
      const [open, close] = s.times;
      // Only include sessions that overlap with visible bars range
      if (close < firstTime || open > lastTime) continue;
      bands.push({
        label: s.label,
        color: s.color,
        openTime:  Math.max(open,  firstTime),
        closeTime: Math.min(close, lastTime),
      });
    }
  }

  return bands;
}
```

- [ ] **Step 3: Implement `calcIBRange`**

```typescript
// IB = High/Low of bars between 09:30–10:30 ET on the last calendar day in bars
export function calcIBRange(bars: Bar[]): { high: number; low: number } | null {
  if (bars.length === 0) return null;

  // Last calendar day present in bars
  const lastDateStr = new Date(bars[bars.length - 1].time * 1000).toISOString().slice(0, 10);
  const etOffsetHours = isUSEDT(new Date(lastDateStr + "T00:00:00Z")) ? 4 : 5;

  const ibOpen  = new Date(lastDateStr + `T${String(9  + etOffsetHours).padStart(2,"0")}:30:00Z`).getTime() / 1000;
  const ibClose = new Date(lastDateStr + `T${String(10 + etOffsetHours).padStart(2,"0")}:30:00Z`).getTime() / 1000;

  const ibBars = bars.filter(b => b.time >= ibOpen && b.time <= ibClose);
  if (ibBars.length === 0) return null;

  return {
    high: Math.max(...ibBars.map(b => b.high)),
    low:  Math.min(...ibBars.map(b => b.low)),
  };
}
```

- [ ] **Step 4: Implement `calcVwap`**

```typescript
// Returns array index-aligned with bars[]; NaN for indices before anchorIndex
export function calcVwap(bars: Bar[], anchorIndex: number): number[] {
  const result = new Array<number>(bars.length).fill(NaN);
  let cumTPV = 0; // cumulative typical_price * volume
  let cumVol = 0; // cumulative volume

  for (let i = anchorIndex; i < bars.length; i++) {
    const bar = bars[i];
    const tp = (bar.high + bar.low + bar.close) / 3;
    cumTPV += tp * bar.volume;
    cumVol += bar.volume;
    result[i] = cumVol > 0 ? cumTPV / cumVol : bar.close;
  }

  return result;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1
```
Expected: 0 errors.

---

### Task 2: Fix chart layout — time scale visible

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Problem:** The chart container `div` uses `flex-1` which has 0 computed height at init. `autoSize: true` reads the container height at that moment → 0 → time scale has no space.

**Fix:** Give the container an explicit pixel height via inline style `height: calc(100vh - 44px)` (toolbar = 44px). Remove `autoSize`. Use `ResizeObserver` to push explicit `width`/`height` on resize.

- [ ] **Step 1: Replace chart container and init options**

In `ReplayEngine.tsx`, replace the chart container div and chart init:

```tsx
{/* Chart — explicit height so time scale is visible */}
<div
  ref={chartContainerRef}
  style={{ width: "100%", height: "calc(100vh - 44px)" }}
/>
```

And replace the `createChart` call:

```typescript
const chart = createChart(chartContainerRef.current, {
  layout: {
    background: { type: ColorType.Solid, color: "#0f1117" },
    textColor: "#9ca3af",
  },
  grid: {
    vertLines: { color: "#1f2937" },
    horzLines: { color: "#1f2937" },
  },
  crosshair: { mode: 1 },
  width:  chartContainerRef.current.clientWidth,
  height: chartContainerRef.current.clientHeight,
  timeScale: {
    borderColor: "#1f2937",
    timeVisible: true,
    secondsVisible: false,
  },
});
```

And update the ResizeObserver to push explicit dimensions:

```typescript
const ro = new ResizeObserver(() => {
  if (!chartContainerRef.current || !chartRef.current) return;
  chartRef.current.applyOptions({
    width:  chartContainerRef.current.clientWidth,
    height: chartContainerRef.current.clientHeight,
  });
});
ro.observe(chartContainerRef.current);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1
```
Expected: 0 errors.

- [ ] **Step 3: Visual check**

Load `/backtest/[id]/replay?from=2026-01-01&to=2026-05-31&tf=m1` — confirm time scale labels appear at the bottom of the chart.

---

### Task 3: Timeframe selector in toolbar

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`
- Modify: `src/app/(app)/backtest/[id]/replay/page.tsx`

**Interfaces:**
- `ReplayEngine` receives new prop: `tf: string` (current timeframe, e.g. `"m1"`)
- On TF button click: `router.push` with updated `tf=` param, keeping `from` and `to` from current URL

- [ ] **Step 1: Add `tf` prop to ReplayEngine and imports**

Add to imports in `ReplayEngine.tsx`:
```typescript
import { useRouter, useSearchParams } from "next/navigation";
```

Update Props type:
```typescript
type Props = {
  backtestId: string;
  instrument: string;
  initialBars: Bar[];
  tf: string;
};
```

- [ ] **Step 2: Add TF selector buttons in toolbar**

Inside the component, after the `engine` declaration:

```typescript
const router = useRouter();
const searchParams = useSearchParams();

function switchTf(newTf: string) {
  const from = searchParams.get("from") ?? "";
  const to   = searchParams.get("to")   ?? "";
  router.push(`/backtest/${backtestId}/replay?from=${from}&to=${to}&tf=${newTf}`);
}
```

In the toolbar JSX, add TF buttons between the instrument name and the date (before speed buttons group):

```tsx
{/* TF selector */}
<div className="flex gap-1">
  {(["m1","m5","m15","h1","h4"] as const).map((t) => (
    <button
      key={t}
      onClick={() => switchTf(t)}
      className="rounded-lg px-2 py-1 text-xs font-bold uppercase"
      style={{
        backgroundColor: tf === t ? "#6366f1" : "#1f2937",
        color: tf === t ? "#fff" : "#9ca3af",
      }}
    >
      {t}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Pass `tf` from page.tsx to ReplayEngine**

In `page.tsx`, the `tf` variable is already read from searchParams. Update the ReplayEngine render call:

```tsx
return <ReplayEngine backtestId={id} instrument={backtest.instrument} initialBars={bars} tf={tf} />;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1
```
Expected: 0 errors.

- [ ] **Step 5: Visual check**

Load replay page, click M5 → page reloads with `tf=m5`, M5 button highlighted in indigo.

---

### Task 4: ICT Sessions overlay

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Approach:** lightweight-charts v5 `IPanePrimitive` drawn on the main pane. The primitive draws colored rectangles on the canvas for each session band. Attached once to the chart pane, updated via a ref holding current bands.

- [ ] **Step 1: Create SessionsPrimitive class**

Add this class inside `ReplayEngine.tsx` (above the component function):

```typescript
import type { IPanePrimitivePaneView, PaneAttachedParameter, IPanePrimitiveBase } from "lightweight-charts";
import { getSessionBands, type SessionBand } from "./indicators";

class SessionsPrimitive implements IPanePrimitiveBase<PaneAttachedParameter<Time>> {
  private _paneView: SessionsPaneView;

  constructor() {
    this._paneView = new SessionsPaneView([]);
  }

  update(bands: SessionBand[]) {
    this._paneView.update(bands);
  }

  paneViews() {
    return [this._paneView];
  }
}

class SessionsPaneView implements IPanePrimitivePaneView {
  private _bands: SessionBand[] = [];
  private _source: { timeScale(): { timeToCoordinate(t: UTCTimestamp): number | null }; } | null = null;
  private _priceScale: { priceToCoordinate(p: number): number | null } | null = null;
  private _ref: PaneAttachedParameter<Time> | null = null;

  constructor(bands: SessionBand[]) {
    this._bands = bands;
  }

  update(bands: SessionBand[]) {
    this._bands = bands;
  }

  attached(ref: PaneAttachedParameter<Time>) {
    this._ref = ref;
  }

  renderer() {
    const ref = this._ref;
    const bands = this._bands;
    return {
      draw(target: { useMediaCoordinateSpace(cb: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => void): void }) {
        target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
          for (const band of bands) {
            const x1 = ref?.timeScale.timeToCoordinate(band.openTime  as UTCTimestamp) ?? null;
            const x2 = ref?.timeScale.timeToCoordinate(band.closeTime as UTCTimestamp) ?? null;
            if (x1 === null || x2 === null) continue;
            ctx.fillStyle = band.color;
            ctx.fillRect(x1, 0, x2 - x1, mediaSize.height);
          }
        });
      },
    };
  }
}
```

**Note:** lightweight-charts v5 `IPanePrimitivePaneView` renderer uses a `draw(target)` API. The `ref` from `attached()` gives access to `timeScale` and `priceScale`. Check the exact `PaneAttachedParameter` type in `typings.d.ts` and adjust if needed.

- [ ] **Step 2: Attach primitive to chart pane in init useEffect**

After `chartRef.current = chart`:

```typescript
const sessionsPrimitive = new SessionsPrimitive();
chart.panes()[0].attachPrimitive(sessionsPrimitive);
sessionsPrimitiveRef.current = sessionsPrimitive;
```

Add ref at top of component:
```typescript
const sessionsPrimitiveRef = useRef<SessionsPrimitive | null>(null);
```

- [ ] **Step 3: Update sessions on every visibleBars change**

In the `useEffect` that calls `setData`, add after `setData`:

```typescript
if (sessionsPrimitiveRef.current) {
  const bands = getSessionBands(engine.visibleBars);
  sessionsPrimitiveRef.current.update(bands);
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1
```

If `IPanePrimitivePaneView` or `PaneAttachedParameter` types cause errors, check exact names in:
```bash
grep -n "PaneAttachedParameter\|IPanePrimitivePaneView\|attachPrimitive" \
  node_modules/.pnpm/lightweight-charts@5.2.0/node_modules/lightweight-charts/dist/typings.d.ts | head -20
```
Adjust imports to match.

- [ ] **Step 5: Visual check**

Load replay with M5 data covering NY session hours — colored bands should appear behind candles.

---

### Task 5: IB Range price lines

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Approach:** Use `series.createPriceLine()` on the candlestick series. 5 lines total (IB High, IB Low, 75%, 50%, 25%). Lines stored in a ref, removed and recreated on every `visibleBars` change.

- [ ] **Step 1: Add IB lines ref at top of component**

```typescript
import { calcIBRange } from "./indicators";
import type { IPriceLine } from "lightweight-charts";

const ibLinesRef = useRef<IPriceLine[]>([]);
```

- [ ] **Step 2: Update IB lines on every visibleBars change**

In the `useEffect` that calls `setData`, add after sessions update:

```typescript
// Remove old IB lines
if (seriesRef.current) {
  for (const line of ibLinesRef.current) {
    seriesRef.current.removePriceLine(line);
  }
  ibLinesRef.current = [];

  const ib = calcIBRange(engine.visibleBars);
  if (ib && seriesRef.current) {
    const range = ib.high - ib.low;
    const levels = [
      { price: ib.high,              title: "IB High", color: "#f8fafc", style: 2 }, // dashed
      { price: ib.low,               title: "IB Low",  color: "#f8fafc", style: 2 },
      { price: ib.low + range * 0.75, title: "75%",   color: "#64748b", style: 1 }, // dotted
      { price: ib.low + range * 0.50, title: "50%",   color: "#64748b", style: 1 },
      { price: ib.low + range * 0.25, title: "25%",   color: "#64748b", style: 1 },
    ];
    for (const lvl of levels) {
      const line = seriesRef.current.createPriceLine({
        price:     lvl.price,
        color:     lvl.color,
        lineWidth: 1,
        lineStyle: lvl.style, // 2=dashed, 1=dotted
        axisLabelVisible: true,
        title:     lvl.title,
      });
      ibLinesRef.current.push(line);
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1
```
Expected: 0 errors.

- [ ] **Step 4: Visual check**

Load replay with data covering 09:30–10:30 ET — IB High/Low dashed white lines and 3 gray dotted intermediate levels should appear.

---

### Task 6: VWAP Anchored

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Approach:** `LineSeries` added once on init. On chart click → find nearest bar index → set anchor. VWAP recalculated and pushed to `LineSeries` on every `visibleBars` change. "Clear VWAP" button appears in toolbar when anchor is set.

- [ ] **Step 1: Add VWAP state and series ref**

```typescript
import { LineSeries } from "lightweight-charts";
import { calcVwap } from "./indicators";
import type { ISeriesApi, LineData } from "lightweight-charts";

const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
const [vwapAnchorIndex, setVwapAnchorIndex] = useState<number | null>(null);
const vwapAnchorIndexRef = useRef<number | null>(null);
```

- [ ] **Step 2: Create VWAP series and subscribe to click in init useEffect**

After candlestick series creation:

```typescript
const vwapSeries = chart.addSeries(LineSeries, {
  color: "#a78bfa",
  lineWidth: 2,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: false,
});
vwapSeriesRef.current = vwapSeries;

chart.subscribeClick((param) => {
  if (!param.time || !param.sourceEvent) return;
  const clickedTime = param.time as number;
  // Find nearest bar index in current bars
  const barsSnap = barsRef.current;
  if (!barsSnap) return;
  let nearest = 0;
  let minDiff = Infinity;
  for (let i = 0; i < barsSnap.length; i++) {
    const diff = Math.abs(barsSnap[i].time - clickedTime);
    if (diff < minDiff) { minDiff = diff; nearest = i; }
  }
  vwapAnchorIndexRef.current = nearest;
  setVwapAnchorIndex(nearest);
});
```

Add `barsRef` to track current bars for use inside the click closure:
```typescript
const barsRef = useRef<Bar[]>(bars);
useEffect(() => { barsRef.current = bars; }, [bars]);
```

- [ ] **Step 3: Update VWAP line on every visibleBars change**

In the `useEffect` that calls `setData`, add after IB lines update:

```typescript
if (vwapSeriesRef.current) {
  const anchor = vwapAnchorIndexRef.current;
  if (anchor !== null && anchor < engine.visibleBars.length) {
    const vwapValues = calcVwap(engine.visibleBars, anchor);
    const vwapData: LineData[] = engine.visibleBars
      .map((b, i) => ({ time: b.time as UTCTimestamp, value: vwapValues[i] }))
      .filter(d => !isNaN(d.value));
    vwapSeriesRef.current.setData(vwapData);
  } else {
    vwapSeriesRef.current.setData([]);
  }
}
```

- [ ] **Step 4: Add "Clear VWAP" button in toolbar**

In the toolbar JSX, after the TF selector:

```tsx
{vwapAnchorIndex !== null && (
  <button
    onClick={() => {
      vwapAnchorIndexRef.current = null;
      setVwapAnchorIndex(null);
      vwapSeriesRef.current?.setData([]);
    }}
    className="rounded-lg px-2 py-1 text-xs font-bold"
    style={{ backgroundColor: "#1f2937", color: "#a78bfa", border: "1px solid #a78bfa" }}
  >
    Clear VWAP
  </button>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1
```
Expected: 0 errors.

- [ ] **Step 6: Visual check**

Load replay → click on a bar → purple VWAP line appears from that bar onward. Click "Clear VWAP" → line disappears.

---

## Self-Review Checklist

- [x] Timeline fix: Task 2 — explicit height + timeVisible + ResizeObserver
- [x] TF selector: Task 3 — buttons in toolbar, router.push preserving from/to
- [x] ICT Sessions DST-aware: Task 1 `isUSEDT` + `sessionTimesUTC`, Task 4 rendering
- [x] IB Range 25/50/75: Task 1 `calcIBRange`, Task 5 price lines
- [x] VWAP Anchored click: Task 1 `calcVwap`, Task 6 click subscription + LineSeries
- [x] No new API routes, no new DB queries
- [x] `#a78bfa` used for VWAP, only allowed hardcoded colors used
- [x] No git commits
- [x] Existing OrderPanel, TradeResultModal, createReplayTrade preserved
