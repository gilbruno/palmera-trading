"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  createTextWatermark,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type IChartApiBase,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  type Time,
  type IPanePrimitiveBase,
  type IPanePrimitivePaneView,
  type IPrimitivePaneRenderer,
  type PaneAttachedParameter,
  type IPriceLine,
  type LineData,
  type MouseEventParams,
  ColorType,
  LineStyle,
  TickMarkType,
} from "lightweight-charts";
import { useReplayEngine, type Bar, type FilledTrade } from "./useReplayEngine";
import { getSessionBands, calcIBRange, calcVwap, type SessionBand } from "./indicators";
import { OrderOverlay, type OrderOverlayState, type DragTarget } from "./OrderOverlay";
import { OrderPanel } from "./OrderPanel";
import { EntryConfirmModal } from "./EntryConfirmModal";
import { ExitConfirmModal } from "./ExitConfirmModal";
import { createReplayTrade, updateReplayTrade } from "./actions";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, TrendingUp, TrendingDown, X } from "lucide-react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// ICT Sessions overlay — IPanePrimitive implementation (lightweight-charts v5)
// ---------------------------------------------------------------------------

// fancy-canvas is a transitive dependency — use a structural type to avoid a
// direct import that may not resolve in every pnpm workspace configuration.
type CanvasTarget2D = {
  useMediaCoordinateSpace<T>(
    f: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => T
  ): T;
};

class SessionsRenderer implements IPrimitivePaneRenderer {
  private _bands: SessionBand[];
  private _chart: IChartApiBase<Time>;

  constructor(bands: SessionBand[], chart: IChartApiBase<Time>) {
    this._bands = bands;
    this._chart = chart;
  }

  draw(target: unknown): void {
    (target as CanvasTarget2D).useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      for (const band of this._bands) {
        const x1 = this._chart.timeScale().timeToCoordinate(band.openTime  as Time);
        const x2 = this._chart.timeScale().timeToCoordinate(band.closeTime as Time);
        if (x1 === null || x2 === null) continue;
        ctx.fillStyle = band.color;
        ctx.fillRect(x1, 0, x2 - x1, mediaSize.height);
      }
    });
  }
}

class SessionsPaneView implements IPanePrimitivePaneView {
  private _bands: SessionBand[] = [];
  private _chart: IChartApiBase<Time> | null = null;

  setChart(chart: IChartApiBase<Time>) { this._chart = chart; }
  update(bands: SessionBand[]) { this._bands = bands; }

  zOrder(): "bottom" { return "bottom"; }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this._chart) return null;
    return new SessionsRenderer(this._bands, this._chart);
  }
}

class SessionsPrimitive implements IPanePrimitiveBase<PaneAttachedParameter<Time>> {
  private _view = new SessionsPaneView();
  private _param: PaneAttachedParameter<Time> | null = null;

  attached(param: PaneAttachedParameter<Time>) {
    this._param = param;
    this._view.setChart(param.chart);
  }

  detached() { this._param = null; }

  update(bands: SessionBand[]) {
    this._view.update(bands);
    this._param?.requestUpdate();
  }

  paneViews(): readonly IPanePrimitivePaneView[] {
    return [this._view];
  }
}

// ---------------------------------------------------------------------------
const TF_BAR_SPACING: Record<string, number> = { m1: 2, m5: 3, m15: 4, h1: 6, h4: 10 };

function tfTickMarkFormatter(time: Time, tickMarkType: TickMarkType, locale: string): string {
  const ts = typeof time === "number" ? time * 1000 : Date.parse(time as string);
  const d = new Date(ts);
  const hhmm = () => d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  const mmdd = () => d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  if (tickMarkType === TickMarkType.Year)       return String(d.getUTCFullYear());
  if (tickMarkType === TickMarkType.Month)      return d.toLocaleDateString(locale, { month: "short" });
  if (tickMarkType === TickMarkType.DayOfMonth) return mmdd();
  return hhmm();
}

// Used at chart init and after a TF data load (resets zoom for new TF then fits content).
function tfTimeScaleOptions(tf: string) {
  return { tickMarkFormatter: tfTickMarkFormatter, barSpacing: TF_BAR_SPACING[tf] ?? 6, minBarSpacing: 1 };
}

// Used in the [tf] effect — updates formatter without resetting user zoom.
function tfFormatterOptions() {
  return { tickMarkFormatter: tfTickMarkFormatter, minBarSpacing: 1 };
}

// ---------------------------------------------------------------------------

type Props = {
  backtestId: string;
  instrument: string;
  initialBars: Bar[];
  initialTf: string;
  from: string;
  to: string;
  fromMs: number;
  toMs: number;
};

export function ReplayEngine({ backtestId, instrument, initialBars, initialTf, from, to, fromMs, toMs }: Props) {
  const [tf, setTf] = useState(initialTf);
  const [bars, setBars] = useState<Bar[]>(initialBars);
  const [isLoadingTf, setIsLoadingTf] = useState(false);
  const [loadingTfTarget, setLoadingTfTarget] = useState<string>("");
  const abortFetchRef = useRef<AbortController | null>(null);
  const exitModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fitOnNextRenderRef = useRef(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const overlayDivRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const sessionsPrimitiveRef = useRef<SessionsPrimitive | null>(null);
  const ibLinesRef = useRef<IPriceLine[]>([]);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapAnchorIndexRef = useRef<number | null>(null);
  const barsRef = useRef<Bar[]>([]);

  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [vwapAnchorIndex, setVwapAnchorIndex] = useState<number | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [exitModal, setExitModal]           = useState<FilledTrade | null>(null);
  const [activeTradeId, setActiveTradeId]   = useState<string | null>(null);
  const [isSaving, setIsSaving]             = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Order overlay (TradingView-style draggable zone)
  const orderOverlayRef = useRef<OrderOverlay | null>(null);
  const [overlayState, setOverlayState] = useState<OrderOverlayState | null>(null);
  const overlayStateRef = useRef<OrderOverlayState | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const watermarkRef = useRef<any>(null);

  // Crosshair OHLC hover display
  type HoverOhlc = { time: number; open: number; high: number; low: number; close: number } | null;
  const [hoverOhlc, setHoverOhlc] = useState<HoverOhlc>(null);
  const hoverOhlcRef = useRef<HoverOhlc>(null);
  // Guard: suppress crosshair events fired by setData() calls to avoid infinite loops
  const isSettingDataRef = useRef(false);

  // Active tool: null = default (pan/zoom), "LONG"/"SHORT" = place order on next click, "VWAP" = anchor VWAP on next click
  type ActiveTool = "LONG" | "SHORT" | "VWAP" | null;
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const activeToolRef = useRef<ActiveTool>(null);

  function setTool(tool: ActiveTool) {
    activeToolRef.current = tool;
    setActiveTool(tool);
  }

  // engineRef allows handleTradeFilled to call engine.pause() without a
  // circular dependency (engine depends on handleTradeFilled via useReplayEngine).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = useRef<any>(null);

  const handleTradeFilled = useCallback((trade: FilledTrade) => {
    engineRef.current?.pause();
    setExitModal(trade);
  }, []);

  // Keep barsRef in sync for use inside the click closure
  useEffect(() => { barsRef.current = bars; }, [bars]);

  const engine = useReplayEngine(bars, { onTradeFilled: handleTradeFilled });
  // Sync engineRef so handleTradeFilled always accesses the latest engine instance.
  engineRef.current = engine;

  const router = useRouter();

  async function switchTf(newTf: string) {
    if (newTf === tf) return;
    abortFetchRef.current?.abort();
    const controller = new AbortController();
    abortFetchRef.current = controller;
    setIsLoadingTf(true);
    setLoadingTfTarget(newTf);
    vwapAnchorIndexRef.current = null;
    setVwapAnchorIndex(null);
    vwapSeriesRef.current?.setData([]);
    orderOverlayRef.current?.clear();
    overlayStateRef.current = null;
    setOverlayState(null);
    try {
      const url = `/api/ohlcv?instrument=${encodeURIComponent(instrument)}&timeframe=${newTf}&from=${fromMs}&to=${toMs}`;
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        const json = await res.json();
        const data: Bar[] = Array.isArray(json) ? json : [];
        if (data.length === 0) return;
        setBars(data);
        setTf(newTf);
        chartRef.current?.applyOptions({ timeScale: tfTimeScaleOptions(newTf) });
        fitOnNextRenderRef.current = true;
        router.replace(`/backtest/${backtestId}/replay?from=${from}&to=${to}&tf=${newTf}`, { scroll: false });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    } finally {
      setIsLoadingTf(false);
    }
  }

  // Init chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

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
      width:  chartContainerRef.current.clientWidth  || window.innerWidth,
      height: chartContainerRef.current.clientHeight || (window.innerHeight - 44),
      timeScale: {
        borderColor: "#1f2937",
        timeVisible: true,
        secondsVisible: false,
        shiftVisibleRangeOnNewBar: false,
        ...tfTimeScaleOptions(initialTf),
      },
    });

    // Watermark — instrument + timeframe, centered top
    const wm = createTextWatermark(chart.panes()[0], {
      horzAlign: "center",
      vertAlign: "top",
      lines: [
        {
          text: `${instrument} · ${tf.toUpperCase()}`,
          color: "rgba(255, 255, 255, 0.12)",
          fontSize: 28,
          fontStyle: "bold",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        },
      ],
    });
    watermarkRef.current = wm;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Order overlay primitive
    const overlay = new OrderOverlay();
    overlay.onChange = (s) => {
      overlayStateRef.current = s;
      setOverlayState({ ...s });
    };
    series.attachPrimitive(overlay);
    orderOverlayRef.current = overlay;

    const vwapSeries = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    vwapSeriesRef.current = vwapSeries;

    chart.subscribeClick((param) => {
      if (!param.time || !param.point) return;
      const tool = activeToolRef.current;
      const clickedTime = param.time as unknown as Time;

      if ((tool === "LONG" || tool === "SHORT") && seriesRef.current) {
        const price = seriesRef.current.coordinateToPrice(param.point.y);
        if (price != null) {
          const atr = price * 0.003;
          const s: OrderOverlayState = tool === "LONG"
            ? { direction: "LONG",  entry: price, sl: price - atr, tp: price + atr * 2 }
            : { direction: "SHORT", entry: price, sl: price + atr, tp: price - atr * 2 };
          overlayStateRef.current = s;
          setOverlayState(s);
          orderOverlayRef.current?.setState(s);
          orderOverlayRef.current?.setAnchorTime(clickedTime);
          setTool(null);
        }
        return;
      }

      if (tool === "VWAP") {
        const clickedTimeNum = param.time as number;
        const barsSnap = barsRef.current;
        let nearest = 0, minDiff = Infinity;
        for (let i = 0; i < barsSnap.length; i++) {
          const diff = Math.abs(barsSnap[i].time - clickedTimeNum);
          if (diff < minDiff) { minDiff = diff; nearest = i; }
        }
        vwapAnchorIndexRef.current = nearest;
        setVwapAnchorIndex(nearest);
        setTool(null); // back to default after anchoring
        return;
      }
    });

    // Crosshair OHLC subscription
    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      if (isSettingDataRef.current) return;
      if (!param.time || !param.point || !seriesRef.current) {
        if (hoverOhlcRef.current !== null) {
          hoverOhlcRef.current = null;
          setHoverOhlc(null);
        }
        return;
      }
      const data = param.seriesData.get(seriesRef.current) as CandlestickData | undefined;
      if (!data) {
        if (hoverOhlcRef.current !== null) {
          hoverOhlcRef.current = null;
          setHoverOhlc(null);
        }
        return;
      }
      const t = param.time as number;
      const prev = hoverOhlcRef.current;
      if (prev && prev.time === t && prev.open === data.open && prev.close === data.close) return;
      const next = { time: t, open: data.open, high: data.high, low: data.low, close: data.close };
      hoverOhlcRef.current = next;
      setHoverOhlc(next);
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    const sessionsPrimitive = new SessionsPrimitive();
    chart.panes()[0].attachPrimitive(sessionsPrimitive);
    sessionsPrimitiveRef.current = sessionsPrimitive;

    // ── Order overlay drag handling ────────────────────────────────────────
    // Architecture (proven by live Chrome debugging):
    //
    // Approach: capture-phase listeners on chartEl (the wrapper div).
    // lightweight-charts listens on its internal canvas — we sit ABOVE it in
    // the capture phase and intercept ONLY when the pointer hits the overlay
    // component. Everything else falls through to the chart untouched.
    //
    // No overlay div toggling needed — capture phase fires before any child.
    const chartEl = chartContainerRef.current;
    const ovDiv   = overlayDivRef.current!;
    ovDiv.style.pointerEvents = "none"; // never used for events, only cursor

    const getCoords = (e: MouseEvent | PointerEvent) => {
      const r = chartEl.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // cursor feedback via window mousemove (capture not needed here)
    const onWindowMouseMove = (e: MouseEvent) => {
      const ov = orderOverlayRef.current;
      if (!ov || !overlayStateRef.current) return;
      if (ov.getDragging() !== null) return;
      const { x, y } = getCoords(e);
      const handle = ov.hitTestHandle(x, y);
      if (handle) {
        ov.setHovered(handle);
        document.body.style.cursor = handle === "resize" ? "ew-resize" : "ns-resize";
      } else if (ov.hitTestBody(x, y)) {
        ov.setHovered("move");
        document.body.style.cursor = "grab";
      } else {
        ov.setHovered(null);
        document.body.style.cursor = "";
      }
    };

    // CAPTURE-phase pointerdown on chartEl — fires before the canvas handler.
    // Block + capture only when hitting the overlay component; otherwise let
    // the event fall through to lightweight-charts normally.
    const onCapturePointerDown = (e: PointerEvent) => {
      const ov = orderOverlayRef.current;
      if (!ov || !overlayStateRef.current) return;
      const { x, y } = getCoords(e);

      const hit = ov.hitTestHandle(x, y);
      if (hit) {
        e.stopPropagation();
        e.preventDefault();
        chartEl.setPointerCapture(e.pointerId);
        ov.setDragging(hit);
        if (hit === "resize") {
          ov.startResize(x);
          document.body.style.cursor = "ew-resize";
        } else {
          document.body.style.cursor = "ns-resize";
        }
        return;
      }

      if (ov.hitTestBody(x, y)) {
        const price = seriesRef.current?.coordinateToPrice(y);
        if (price != null) {
          e.stopPropagation();
          e.preventDefault();
          chartEl.setPointerCapture(e.pointerId);
          ov.startMove(x, price);
          ov.setDragging("move");
          document.body.style.cursor = "grabbing";
        }
        return;
      }
      // Outside component → let the event through to the chart (no action)
    };

    // CAPTURE-phase pointermove — handles drag movement
    const onCapturePointerMove = (e: PointerEvent) => {
      const ov = orderOverlayRef.current;
      if (!ov) return;
      const drag = ov.getDragging();
      if (!drag) return;
      // We have pointer capture — stop it reaching the chart
      e.stopPropagation();
      const { x, y } = getCoords(e);
      const price = seriesRef.current?.coordinateToPrice(y);
      if (price == null) return;
      if (drag === "move") ov.applyMove(x, price);
      else if (drag === "resize") ov.applyResize(x);
      else ov.applyDrag(price);
    };

    // CAPTURE-phase pointerup — release and reset
    const onCapturePointerUp = (e: PointerEvent) => {
      const ov = orderOverlayRef.current;
      if (!ov || ov.getDragging() === null) return;
      e.stopPropagation();
      chartEl.releasePointerCapture(e.pointerId);
      ov.setDragging(null);
      const { x, y } = getCoords(e);
      if (ov.hitTestHandle(x, y) || ov.hitTestBody(x, y)) {
        document.body.style.cursor = "grab";
      } else {
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", onWindowMouseMove);
    chartEl.addEventListener("pointerdown",   onCapturePointerDown,  { capture: true });
    chartEl.addEventListener("pointermove",   onCapturePointerMove,  { capture: true });
    chartEl.addEventListener("pointerup",     onCapturePointerUp,    { capture: true });
    chartEl.addEventListener("pointercancel", onCapturePointerUp,    { capture: true });

    const syncSize = () => {
      if (!chartContainerRef.current || !chartRef.current) return;
      const w = chartContainerRef.current.clientWidth;
      const h = chartContainerRef.current.clientHeight;
      if (w > 0 && h > 0) chartRef.current.applyOptions({ width: w, height: h });
    };
    const ro = new ResizeObserver(syncSize);
    ro.observe(chartContainerRef.current);
    // Force sync after first paint in case clientHeight was 0 at createChart time
    requestAnimationFrame(syncSize);

    return () => {
      ro.disconnect();
      window.removeEventListener("mousemove", onWindowMouseMove);
      chartEl.removeEventListener("pointerdown",   onCapturePointerDown,  { capture: true });
      chartEl.removeEventListener("pointermove",   onCapturePointerMove,  { capture: true });
      chartEl.removeEventListener("pointerup",     onCapturePointerUp,    { capture: true });
      chartEl.removeEventListener("pointercancel", onCapturePointerUp,    { capture: true });
      document.body.style.cursor = "";
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.remove();
      if (exitModalTimerRef.current) clearTimeout(exitModalTimerRef.current);
    };
  }, []);

  // Update watermark text when instrument or tf changes
  useEffect(() => {
    const wm = watermarkRef.current;
    if (!wm?.applyOptions) return;
    wm.applyOptions({
      lines: [{
        text: `${instrument} · ${tf.toUpperCase()}`,
        color: "rgba(255, 255, 255, 0.12)",
        fontSize: 28,
        fontStyle: "bold",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }],
    });
  }, [instrument, tf]);

  // Update formatter only — barSpacing reset happens in switchTf to preserve user zoom
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({ timeScale: tfFormatterOptions() });
  }, [tf]);

  // Update chart on every visibleBars change
  useEffect(() => {
    if (!seriesRef.current) return;
    const data: CandlestickData[] = engine.visibleBars.map((b) => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    isSettingDataRef.current = true;
    seriesRef.current.setData(data);
    isSettingDataRef.current = false;
    if (fitOnNextRenderRef.current) {
      fitOnNextRenderRef.current = false;
      chartRef.current?.timeScale().fitContent();
    }
    if (sessionsPrimitiveRef.current) {
      const bands = getSessionBands(engine.visibleBars);
      sessionsPrimitiveRef.current.update(bands);
    }

    // IB Range price lines
    if (seriesRef.current) {
      for (const line of ibLinesRef.current) {
        seriesRef.current.removePriceLine(line);
      }
      ibLinesRef.current = [];
      const ib = calcIBRange(engine.visibleBars);
      if (ib) {
        const range = ib.high - ib.low;
        const levels = [
          { price: ib.high,               title: "IB High", color: "#f8fafc", lineStyle: LineStyle.Dashed },
          { price: ib.low,                title: "IB Low",  color: "#f8fafc", lineStyle: LineStyle.Dashed },
          { price: ib.low + range * 0.75, title: "75%",     color: "#64748b", lineStyle: LineStyle.Dotted },
          { price: ib.low + range * 0.50, title: "50%",     color: "#64748b", lineStyle: LineStyle.Dotted },
          { price: ib.low + range * 0.25, title: "25%",     color: "#64748b", lineStyle: LineStyle.Dotted },
        ];
        for (const lvl of levels) {
          const line = seriesRef.current.createPriceLine({
            price: lvl.price,
            color: lvl.color,
            lineWidth: 1,
            lineStyle: lvl.lineStyle,
            axisLabelVisible: true,
            title: lvl.title,
          });
          ibLinesRef.current.push(line);
        }
      }
    }

    // VWAP Anchored
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

  }, [engine.visibleBars]);

  async function handleEntryConfirm() {
    if (!overlayState || !engine.currentBar) return;
    setIsSaving(true);
    try {
      const id = await createReplayTrade(backtestId, {
        direction:  overlayState.direction,
        entryPrice: overlayState.entry,
        stopLoss:   overlayState.sl,
        takeProfit: overlayState.tp,
        entryDate:  new Date(engine.currentBar.time * 1000),
      });
      setActiveTradeId(id);
      engine.placeOrder({
        direction:     overlayState.direction,
        entryPrice:    overlayState.entry,
        stopLoss:      overlayState.sl,
        takeProfit:    overlayState.tp,
        entryBarIndex: engine.currentIndex,
      });
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

  async function handleExitSave(notes: string) {
    if (!exitModal || !activeTradeId) return;
    setIsSaving(true);
    try {
      await updateReplayTrade(
        activeTradeId,
        {
          exitPrice: exitModal.exitPrice,
          exitDate:  new Date(exitModal.exitBar.time * 1000),
          outcome:   exitModal.outcome,
          rMultiple: exitModal.rMultiple,
          pnlPoints: exitModal.pnlPoints,
        },
        notes
      );
      setActiveTradeId(null);
      if (exitModalTimerRef.current) clearTimeout(exitModalTimerRef.current);
      exitModalTimerRef.current = setTimeout(() => setExitModal(null), 1800);
    } finally {
      setIsSaving(false);
    }
  }

  const currentPrice = engine.currentBar?.close ?? 0;

  return (
    <div
      ref={wrapperRef}
      className={`relative flex flex-col overflow-hidden${isFullscreen ? " fixed inset-0 z-50" : " h-full w-full"}`}
      style={{ backgroundColor: "#0f1117" }}
    >
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center gap-3 px-4 py-2"
        style={{ borderBottom: "1px solid #1f2937" }}
      >
        <Link
          href={`/backtest/${backtestId}`}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg"
          style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
        >
          <ArrowLeft size={14} />
        </Link>

        <span className="text-sm font-bold" style={{ color: "#a5b4fc" }}>
          {instrument}
        </span>

        {/* TF selector */}
        <div className="flex gap-1">
          {(["m1","m5","m15","h1","h4"] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTf(t)}
              className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold uppercase"
              style={{
                backgroundColor: tf === t ? "#6366f1" : "#1f2937",
                color: tf === t ? "#fff" : "#9ca3af",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Tool buttons ── */}
        <div className="flex items-center gap-1">
          {/* Long */}
          {(["LONG", "SHORT"] as const).map((dir) => {
            const isLong = dir === "LONG";
            const ac = isLong ? "#22c55e" : "#ef4444";
            const isActive = activeTool === dir || overlayState?.direction === dir;
            return (
              <button key={dir}
                onClick={() => {
                  if (activeTool === dir) { setTool(null); return; }
                  overlayStateRef.current = null; setOverlayState(null); orderOverlayRef.current?.clear();
                  if (overlayDivRef.current) overlayDivRef.current.style.pointerEvents = "none";
                  setTool(dir);
                }}
                className="cursor-pointer inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold"
                style={{
                  backgroundColor: isActive ? `${ac}28` : "rgba(255,255,255,0.05)",
                  color: isActive ? ac : "#9ca3af",
                  border: `1px solid ${isActive ? ac : "transparent"}`,
                }}
              >
                {isLong ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {isLong ? "Long" : "Short"}
              </button>
            );
          })}

          {/* VWAP tool */}
          <button
            onClick={() => {
              if (activeTool === "VWAP") {
                // second click = clear
                setTool(null);
                vwapAnchorIndexRef.current = null;
                setVwapAnchorIndex(null);
                vwapSeriesRef.current?.setData([]);
              } else {
                setTool("VWAP");
              }
            }}
            className="cursor-pointer inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold"
            style={{
              backgroundColor: activeTool === "VWAP" || vwapAnchorIndex !== null ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.05)",
              color: activeTool === "VWAP" || vwapAnchorIndex !== null ? "#a78bfa" : "#9ca3af",
              border: `1px solid ${activeTool === "VWAP" || vwapAnchorIndex !== null ? "#a78bfa" : "transparent"}`,
            }}
          >
            VWAP{vwapAnchorIndex !== null ? " ×" : ""}
          </button>

          {/* Hint */}
          {activeTool && !overlayState && (
            <span className="text-xs animate-pulse" style={{ color: "#9ca3af" }}>
              ← cliquez sur le graphe
            </span>
          )}

          {/* Confirm / Cancel when overlay placed */}
          {overlayState && (
            <>
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
        </div>

        <span className="text-sm" style={{ color: "#6b7280" }}>
          {engine.currentBar
            ? new Date(engine.currentBar.time * 1000).toUTCString().slice(0, 22)
            : "—"}
        </span>
        <span className="font-mono text-sm" style={{ color: "#f9fafb" }}>
          {currentPrice.toFixed(5)}
        </span>

        <div className="ml-auto flex items-center gap-3">
          {/* Speed buttons */}
          <div className="flex gap-1">
            {([1, 2, 5, 10] as const).map((s) => (
              <button
                key={s}
                onClick={() => engine.setSpeed(s)}
                className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold"
                style={{
                  backgroundColor: engine.speed === s ? "#6366f1" : "#1f2937",
                  color: engine.speed === s ? "#fff" : "#9ca3af",
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Playback controls */}
          <div className="flex gap-1">
            <button
              onClick={engine.stepBackward}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
              title="← 1 bar"
            >
              ◀
            </button>
            <button
              onClick={engine.isPlaying ? engine.pause : engine.play}
              className="cursor-pointer rounded-lg px-4 py-1.5 text-sm font-bold"
              style={{
                backgroundColor: engine.isPlaying ? "#ef4444" : "#22c55e",
                color: "#fff",
              }}
            >
              {engine.isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={engine.stepForward}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
              title="1 bar →"
            >
              ▶
            </button>
          </div>

          {/* Order button */}
          <button
            onClick={() => {
              engine.pause();
              setShowOrderPanel(true);
            }}
            disabled={!!engine.pendingOrder}
            className="cursor-pointer rounded-xl px-4 py-1.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}
          >
            {engine.pendingOrder ? "Order Active" : "+ Order"}
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen((v) => !v)}
            className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
            title={isFullscreen ? "Réduire" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Chart + transparent overlay div for order component drag */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={chartContainerRef}
          className="absolute inset-0"
          style={{ cursor: activeTool && !overlayState ? "crosshair" : undefined }}
        />
        {/* Transparent intercept layer — pointer-events toggled imperatively by JS.
            No inline style here — React would overwrite the JS-set value on re-render. */}
        <div
          ref={overlayDivRef}
          className="absolute inset-0"
        />

        {/* TF loader overlay */}
        {isLoadingTf && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none select-none"
            style={{ backgroundColor: "rgba(15,17,23,0.80)", backdropFilter: "blur(3px)" }}
          >
            <div className="flex flex-col items-center gap-4">
              {/* Ring spinner */}
              <div className="relative h-10 w-10">
                <div
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: "rgba(99,102,241,0.18)" }}
                />
                <div
                  className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
                  style={{ borderTopColor: "#6366f1" }}
                />
              </div>
              {/* Label */}
              <div className="flex flex-col items-center gap-1">
                <span
                  className="text-[11px] font-medium uppercase tracking-[0.2em]"
                  style={{ color: "#6b7280" }}
                >
                  Loading
                </span>
                <span
                  className="text-sm font-bold uppercase tracking-widest"
                  style={{ color: "#a5b4fc" }}
                >
                  {loadingTfTarget.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* OHLC crosshair display — TradingView-style top-left of chart pane */}
        {hoverOhlc && (
          <div
            className="absolute left-2 top-2 flex items-center gap-3 rounded-md px-3 py-1.5 pointer-events-none select-none"
            style={{
              backgroundColor: "rgba(15,17,23,0.88)",
              border: "1px solid #1f2937",
              backdropFilter: "blur(4px)",
              fontSize: "11px",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              lineHeight: 1,
              zIndex: 10,
            }}
          >
            <span style={{ color: "#6b7280" }}>
              {new Date(hoverOhlc.time * 1000).toUTCString().slice(0, 22)}
            </span>
            <span style={{ color: "#6b7280" }}>O</span>
            <span style={{ color: "#d1d5db" }}>{hoverOhlc.open.toFixed(5)}</span>
            <span style={{ color: "#4ade80" }}>H</span>
            <span style={{ color: "#4ade80" }}>{hoverOhlc.high.toFixed(5)}</span>
            <span style={{ color: "#f87171" }}>L</span>
            <span style={{ color: "#f87171" }}>{hoverOhlc.low.toFixed(5)}</span>
            <span style={{ color: "#6b7280" }}>C</span>
            <span style={{ color: hoverOhlc.close >= hoverOhlc.open ? "#4ade80" : "#f87171" }}>
              {hoverOhlc.close.toFixed(5)}
            </span>
          </div>
        )}
      </div>

      {/* Order panel */}
      {showOrderPanel && !engine.pendingOrder && (
        <OrderPanel
          currentPrice={currentPrice}
          currentBarIndex={engine.currentIndex}
          onConfirm={(order) => {
            engine.placeOrder(order);
            setShowOrderPanel(false);
            engine.play();
          }}
          onCancel={() => setShowOrderPanel(false)}
        />
      )}

      {/* Entry confirm modal */}
      {entryModalOpen && overlayState && engine.currentBar && (
        <EntryConfirmModal
          overlayState={overlayState}
          entryBar={engine.currentBar}
          onConfirm={handleEntryConfirm}
          onCancel={() => { setEntryModalOpen(false); engine.play(); }}
          isSaving={isSaving}
        />
      )}

      {/* Exit confirm modal */}
      {exitModal && (
        <ExitConfirmModal
          trade={exitModal}
          onSave={handleExitSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
