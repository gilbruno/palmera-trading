//
// OrderOverlay — TradingView-style Entry/SL/TP rectangle primitive.
// Fully draggable: X axis via _offsetX, Y axis via price levels.
//
import type {
  ISeriesPrimitiveBase,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  ISeriesApi,
  IChartApiBase,
  Time,
  SeriesType,
} from "lightweight-charts";

export type OrderOverlayState = {
  direction: "LONG" | "SHORT";
  entry: number;
  sl: number;
  tp: number;
};

// "move" = drag the whole component; others = drag one level
export type DragTarget = "entry" | "sl" | "tp" | "move" | null;

type CanvasTarget2D = {
  useMediaCoordinateSpace<T>(
    f: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => T
  ): T;
};

const RECT_WIDTH  = 420;
const HANDLE_HALF = 7;
const LABEL_H     = 20;
const FONT        = "bold 11px -apple-system,sans-serif";
const HANDLE_COL  = "#2962ff";
const HANDLE_HOV  = "#5b9bff";

// ─── Renderer ────────────────────────────────────────────────────────────────

class OrderRenderer implements IPrimitivePaneRenderer {
  constructor(
    private _s: OrderOverlayState,
    private _series: ISeriesApi<SeriesType, Time>,
    private _hov: DragTarget,
    private _anchorTime: Time,           // X anchor — follows chart scroll/zoom
    private _chart: IChartApiBase<Time>,
  ) {}

  draw(target: unknown): void {
    (target as CanvasTarget2D).useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { direction, entry, sl, tp } = this._s;

      const yE = this._series.priceToCoordinate(entry);
      const yS = this._series.priceToCoordinate(sl);
      const yT = this._series.priceToCoordinate(tp);
      if (yE === null || yS === null || yT === null) return;

      const isLong = direction === "LONG";

      // X from anchorTime: timeToCoordinate → CSS px → scale to physical px via dpr
      const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
      const anchorCss = this._chart.timeScale().timeToCoordinate(this._anchorTime);
      if (anchorCss === null) return;
      const x1 = Math.max(0, Math.min(anchorCss * dpr, mediaSize.width - RECT_WIDTH * dpr));
      const rectW = RECT_WIDTH * dpr;
      const x2 = x1 + rectW;

      // SL zone
      const slFill = isLong ? "rgba(239,68,68,0.20)" : "rgba(34,197,94,0.20)";
      const slLine = isLong ? "#ef4444" : "#22c55e";
      ctx.fillStyle = slFill;
      ctx.fillRect(x1, Math.min(yE, yS), rectW, Math.abs(yE - yS));

      // TP zone
      const tpFill = isLong ? "rgba(34,197,94,0.20)" : "rgba(239,68,68,0.20)";
      const tpLine = isLong ? "#22c55e" : "#ef4444";
      ctx.fillStyle = tpFill;
      ctx.fillRect(x1, Math.min(yE, yT), rectW, Math.abs(yE - yT));

      // Rectangle border
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, Math.min(yS, yT), rectW, Math.abs(yT - yS));
      ctx.restore();

      // Per-level: line + label + handle
      const levels: { y: number; lineCol: string; labelBg: string; label: string; target: DragTarget }[] = [
        { y: yT, lineCol: tpLine,    labelBg: tpLine,    label: `TP  ${tp.toFixed(5)}`,    target: "tp"    },
        { y: yE, lineCol: "#f8fafc", labelBg: "#334155", label: `Entry  ${entry.toFixed(5)}`, target: "entry" },
        { y: yS, lineCol: slLine,    labelBg: slLine,    label: `SL  ${sl.toFixed(5)}`,    target: "sl"    },
      ];

      for (const { y, lineCol, labelBg, label, target } of levels) {
        const hov = this._hov === target;

        // Line inside rect
        ctx.save();
        ctx.strokeStyle = lineCol;
        ctx.lineWidth = hov ? 2 : 1;
        ctx.setLineDash(target === "entry" ? [] : [5, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Label pill — right side
        ctx.save();
        ctx.font = FONT;
        const tw = ctx.measureText(label).width;
        const pw = tw + 14;
        const lx = x2 - pw - 4;
        const ly = y - LABEL_H / 2;
        ctx.fillStyle = labelBg;
        ctx.globalAlpha = hov ? 1 : 0.88;
        roundRect(ctx, lx, ly, pw, LABEL_H, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, lx + 7, y);
        ctx.restore();

        // Square handle — left edge
        const hx = x1 - HANDLE_HALF;
        const hy = y - HANDLE_HALF;
        ctx.save();
        ctx.fillStyle = hov ? HANDLE_HOV : HANDLE_COL;
        ctx.fillRect(hx, hy, HANDLE_HALF * 2, HANDLE_HALF * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.strokeRect(hx, hy, HANDLE_HALF * 2, HANDLE_HALF * 2);
        ctx.restore();
      }
    });
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── PaneView ────────────────────────────────────────────────────────────────

class OrderPaneView implements IPrimitivePaneView {
  private _state: OrderOverlayState | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _hov: DragTarget = null;
  private _anchorTime: Time = 0 as Time;
  private _chart: IChartApiBase<Time> | null = null;

  update(s: OrderOverlayState | null, series: ISeriesApi<SeriesType, Time> | null, hov: DragTarget, anchorTime: Time, chart: IChartApiBase<Time> | null) {
    this._state = s; this._series = series; this._hov = hov; this._anchorTime = anchorTime; this._chart = chart;
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this._state || !this._series || !this._chart) return null;
    return new OrderRenderer(this._state, this._series, this._hov, this._anchorTime, this._chart);
  }
}

// ─── Primitive ───────────────────────────────────────────────────────────────

export class OrderOverlay implements ISeriesPrimitiveBase<SeriesAttachedParameter<Time>> {
  private _view = new OrderPaneView();
  private _param: SeriesAttachedParameter<Time> | null = null;
  private _chart: IChartApiBase<Time> | null = null;
  private _state: OrderOverlayState | null = null;
  private _hov: DragTarget = null;
  private _drag: DragTarget = null;
  // X anchor: stored as a chart timestamp so the component follows scroll/zoom
  private _anchorTime: Time = 0 as Time;
  private _moveStartX = 0;
  private _moveStartAnchorTime: Time = 0 as Time;
  private _moveStartPrice = 0;
  private _moveStartState: OrderOverlayState | null = null;

  onChange: ((s: OrderOverlayState) => void) | null = null;

  attached(p: SeriesAttachedParameter<Time>) {
    this._param = p;
    this._chart = p.chart;
  }
  detached() { this._param = null; this._chart = null; }

  // Call with the clicked timestamp to anchor X (from subscribeClick param.time)
  setAnchorTime(t: Time) {
    this._anchorTime = t;
    this._refresh();
  }

  setState(s: OrderOverlayState | null) { this._state = s; this._refresh(); }

  setHovered(h: DragTarget) {
    if (this._hov === h) return;
    this._hov = h;
    this._refresh();
  }

  setDragging(d: DragTarget) { this._drag = d; }
  getDragging(): DragTarget { return this._drag; }

  startMove(anchorX: number, anchorPrice: number) {
    if (!this._state) return;
    this._moveStartX = anchorX;
    this._moveStartAnchorTime = this._anchorTime;
    this._moveStartPrice = anchorPrice;
    this._moveStartState = { ...this._state };
  }

  applyDrag(newPrice: number) {
    if (!this._state || !this._drag || this._drag === "move") return;
    const s = { ...this._state, [this._drag]: newPrice };
    this._state = s;
    this._refresh();
    this.onChange?.(s);
  }

  applyMove(currentX: number, currentPrice: number) {
    if (!this._state || !this._moveStartState || !this._chart) return;
    // Update X anchor: convert current pixel position to time
    const newTime = this._chart.timeScale().coordinateToTime(currentX);
    if (newTime !== null) this._anchorTime = newTime;
    // Update Y levels
    const dp = currentPrice - this._moveStartPrice;
    const s: OrderOverlayState = {
      ...this._moveStartState,
      entry: this._moveStartState.entry + dp,
      sl:    this._moveStartState.sl    + dp,
      tp:    this._moveStartState.tp    + dp,
    };
    this._state = s;
    this._refresh();
    this.onChange?.(s);
  }

  // Current X in CSS pixels (for hit testing)
  private _getOffsetX(): number {
    if (!this._chart) return 60;
    const x = this._chart.timeScale().timeToCoordinate(this._anchorTime);
    return x ?? 60;
  }

  hitTestHandle(x: number, y: number): DragTarget {
    if (!this._state || !this._param) return null;
    const ox = this._getOffsetX();
    const inX = x >= ox - HANDLE_HALF - 4 && x <= ox + HANDLE_HALF + 4;
    if (!inX) return null;
    const series = this._param.series;
    for (const key of ["entry", "sl", "tp"] as const) {
      const coord = series.priceToCoordinate(this._state[key]);
      if (coord !== null && Math.abs(coord - y) <= HANDLE_HALF + 4) return key;
    }
    return null;
  }

  hitTestBody(x: number, y: number): boolean {
    if (!this._state || !this._param) return false;
    const ox = this._getOffsetX();
    if (x < ox + HANDLE_HALF + 6 || x > ox + RECT_WIDTH) return false;
    const series = this._param.series;
    const yS = series.priceToCoordinate(this._state.sl);
    const yT = series.priceToCoordinate(this._state.tp);
    if (yS === null || yT === null) return false;
    return y >= Math.min(yS, yT) - 4 && y <= Math.max(yS, yT) + 4;
  }

  clear() {
    this._state = null; this._hov = null; this._drag = null;
    this._anchorTime = 0 as Time;
    this._refresh();
  }

  getState(): OrderOverlayState | null { return this._state; }
  paneViews(): readonly IPrimitivePaneView[] { return [this._view]; }

  private _refresh() {
    this._view.update(this._state, this._param?.series ?? null, this._hov, this._anchorTime, this._chart);
    this._param?.requestUpdate();
  }
}
