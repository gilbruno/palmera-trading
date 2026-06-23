# Replay Engine v2 — Indicators + TF Selector + Timeline Fix

## Goal

Fix the timeline display, add a timeframe selector, and add 4 indicators to the existing ReplayEngine: VWAP Anchored (click-to-anchor), IB Range (9h30-10h30 NY with 25/50/75% levels), and ICT Sessions (Asia, London, NY AM, NY PM).

## Architecture

All computation is client-side. No new API routes. Indicators are calculated in memory from `visibleBars` and drawn using lightweight-charts v5 primitives.

### Files

- **Modify:** `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx` — fix layout, add TF selector, wire indicators
- **Create:** `src/app/(app)/backtest/[id]/replay/indicators.ts` — pure functions: `calcVwap`, `calcIBRange`, `getSessionBands`
- **Modify:** `src/app/(app)/backtest/[id]/replay/page.tsx` — pass `tf` prop to `ReplayEngine`

## Fix: Timeline (time scale) not visible

**Root cause:** `autoSize: true` + `flex-1` div has 0 height at init time — lightweight-charts renders with height=0, time scale is invisible.

**Fix:** Give the chart container an explicit height using CSS: `height: calc(100vh - 44px)` where 44px is the toolbar height. Remove `autoSize`. Use `ResizeObserver` to sync width and height explicitly.

## Feature: Timeframe Selector

Buttons in toolbar: `M1 | M5 | M15 | H1 | H4`

On click → `router.push(`/backtest/${backtestId}/replay?from=...&to=...&tf=<new>`)` — preserves `from`/`to` from current URL, only changes `tf`. Page server re-renders with re-aggregated M1 bars.

Current `tf` highlighted with `#6366f1` background.

`ReplayEngine` receives `tf` as a prop (string) and current URL params via `useSearchParams()` to build the new URL on TF change.

## Feature: ICT Sessions

**Hours (UTC, DST-aware via JS Date):**
- Asia: 20:00–00:00 previous day UTC (= 21:00–01:00 UTC+1, adjusts automatically)
- London: 02:00–05:00 UTC
- NY AM: 13:30–16:00 UTC (= 9:30–12:00 ET)
- NY PM: 18:00–21:00 UTC (= 14:00–17:00 ET)

**Implementation:** lightweight-charts v5 `ISeriesPrimitive` plugin drawn as background rectangles on the time scale. Each session = a filled rectangle from session open to session close, spanning full price range.

**Colors (semi-transparent):**
- Asia: `rgba(148, 163, 184, 0.06)` (slate)
- London: `rgba(59, 130, 246, 0.08)` (blue)
- NY AM: `rgba(34, 197, 94, 0.08)` (green)
- NY PM: `rgba(249, 115, 22, 0.08)` (orange)

**`getSessionBands(bars)`** → returns array of `{ label, color, openTime, closeTime }` for each session visible in current bars.

Sessions recomputed on every `visibleBars` change.

## Feature: IB Range (Initial Balance)

**Definition:** High and Low of bars between 13:30 UTC and 14:30 UTC (= 9:30–10:30 ET). Computed per calendar day.

**Levels drawn as `createPriceLine`:**
- IB High: white dashed
- IB Low: white dashed
- 75% = IBLow + 0.75 × (IBHigh - IBLow): gray dotted
- 50% = IBLow + 0.50 × (IBHigh - IBLow): gray dotted (midpoint)
- 25% = IBLow + 0.25 × (IBHigh - IBLow): gray dotted

Only the IB of the **current visible day** (last bar's date) is shown. Lines are updated on every `visibleBars` change.

**`calcIBRange(bars)`** → `{ high, low } | null` for the current day's IB.

## Feature: VWAP Anchored (click-to-anchor)

**Trigger:** User clicks on the chart → `chart.subscribeClick(handler)` → anchor set to the clicked bar's index (nearest bar by time).

**Calculation:** `calcVwap(bars, anchorIndex)` → for each bar from anchorIndex to end: `VWAP[i] = Σ(typical_price × volume) / Σ(volume)` where `typical_price = (high + low + close) / 3`.

**Rendering:** `LineSeries` overlaid on the chart, color `#a78bfa` (purple), line width 2.

**Reset:** Button "Clear VWAP" appears in toolbar when anchor is set. Click → clears anchor and removes VWAP line.

**State:** `vwapAnchorIndex: number | null` in `ReplayEngine` component state.

VWAP recomputed on every `visibleBars` change (anchor index stays fixed, new bars added at end extend the VWAP line).

## Global Constraints

- `"use client"` on ReplayEngine
- CSS vars for UI chrome, hardcoded only: `#6366f1`, `#22c55e`, `#ef4444`, `#a78bfa`
- No new API routes
- No new DB queries
- lightweight-charts v5 API (`addSeries`, `ISeriesPrimitive`)
- Preserve existing playback, order panel, trade result modal
- No git commits (developer commits manually)
