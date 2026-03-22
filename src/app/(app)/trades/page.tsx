import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import type { Direction, TradeOutcome } from "@/generated/prisma/enums";
import { AddTradePanel } from "./AddTradePanel";
import { TradeRow, type TradeRowData } from "./TradeRow";
import { TradesFilter } from "./TradesFilter";
import { Suspense } from "react";

/* ─── Stat helpers ──────────────────────────────────────────────────────── */
interface StatInput {
  outcome: TradeOutcome | null;
  pnlNet: { toNumber(): number } | null;
  rMultiple: { toNumber(): number } | null;
}

function computeStats(trades: StatInput[]) {
  const closed = trades.filter((t) => t.outcome !== null);
  const total = closed.length;

  const wins = closed.filter((t) => t.outcome === "WIN");
  const losses = closed.filter((t) => t.outcome === "LOSS");

  const totalPnl = closed.reduce((sum, t) => sum + (t.pnlNet?.toNumber() ?? 0), 0);

  const withR = closed.filter((t) => t.rMultiple !== null);
  const sumWinR = wins.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!.toNumber(), 0);
  const sumLossR = Math.abs(losses.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!.toNumber(), 0));
  const profitFactor = sumLossR > 0 ? sumWinR / sumLossR : sumWinR > 0 ? Infinity : null;
  const totalR = withR.reduce((s, t) => s + t.rMultiple!.toNumber(), 0);
  const expectancy = withR.length > 0 ? totalR / withR.length : null;

  return {
    total,
    totalAll: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: closed.filter((t) => t.outcome === "BREAKEVEN").length,
    open: trades.filter((t) => t.outcome === null).length,
    winrate: total > 0 ? (wins.length / total) * 100 : null,
    profitFactor,
    expectancy,
    totalPnl,
    totalR,
  };
}

function fmtPnl(v: number): string {
  return (v >= 0 ? "+" : "") + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number | null): string {
  return v != null ? v.toFixed(1) + "%" : "—";
}

function fmtPF(v: number | null): string {
  if (v == null) return "—";
  if (!isFinite(v)) return "∞";
  return v.toFixed(2);
}

function fmtR(v: number | null): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "R";
}

/* ─── KPI cell ──────────────────────────────────────────────────────────── */
function KpiCell({
  label, value, positive, neutral, sub,
}: {
  label: string; value: string; positive?: boolean; neutral?: boolean; sub?: string;
}) {
  const color = neutral
    ? "var(--text-secondary)"
    : value === "—"
    ? "var(--text-muted)"
    : positive
    ? "var(--accent-tertiary-light)"
    : "#f87171";

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-3 py-3 text-center"
      style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
    >
      <p
        className="mb-1 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)", fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", letterSpacing: "0.12em" }}
      >
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{sub}</p>
      )}
    </div>
  );
}

/* ─── Equity bar (segmented P&L strip) ──────────────────────────────────── */
function PnlBar({
  trades,
}: {
  trades: { outcome: TradeOutcome | null; pnlNet: { toNumber(): number } | null }[];
}) {
  const closed = trades.filter((t) => t.outcome !== null && t.pnlNet !== null);
  if (closed.length === 0) return null;

  const total = closed.length;

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl px-5 py-3"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <p
        className="mb-2 text-sm font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)", fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif" }}
      >
        P&L strip · {total} closed trades
      </p>
      <div
        className="flex h-2 w-full gap-px overflow-hidden rounded-full"
        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
      >
        {closed.map((t, i) => {
          const pnl = t.pnlNet!.toNumber();
          const color = pnl > 0 ? "var(--accent-tertiary)" : pnl < 0 ? "#ef4444" : "var(--text-muted)";
          return (
            <div
              key={i}
              style={{ width: `${100 / total}%`, backgroundColor: color, flexShrink: 0 }}
              title={`Trade ${i + 1}: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Column headers ────────────────────────────────────────────────────── */
function TableHeader() {
  return (
    <div
      className="flex items-center gap-3 border-b px-5 py-2"
      style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.01)" }}
    >
      <span className="w-6 shrink-0" />
      <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Symbol / Date</span>
      <span className="hidden sm:block w-28 shrink-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Prices</span>
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Result</span>
      <span className="hidden md:block w-20 shrink-0 text-right text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>P&L Net</span>
      <span className="hidden md:block w-16 shrink-0 text-right text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>R</span>
      <span className="hidden lg:block w-20 shrink-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Quality</span>
      <span className="hidden lg:flex flex-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Tags</span>
      <span className="ml-auto w-16 shrink-0" />
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
interface PageProps {
  searchParams: Promise<{
    symbol?: string;
    direction?: string;
    outcome?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function TradesPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const sp = await searchParams;
  const userId = session.user.id;

  // Build filter
  const where: Record<string, unknown> = { userId };

  if (sp.symbol) {
    where.symbol = { contains: sp.symbol.toUpperCase() };
  }
  if (sp.direction === "LONG" || sp.direction === "SHORT") {
    where.direction = sp.direction as Direction;
  }
  if (sp.outcome === "OPEN") {
    where.outcome = null;
  } else if (sp.outcome === "WIN" || sp.outcome === "LOSS" || sp.outcome === "BREAKEVEN") {
    where.outcome = sp.outcome as TradeOutcome;
  }
  if (sp.from || sp.to) {
    const entryTime: Record<string, Date> = {};
    if (sp.from) entryTime.gte = new Date(sp.from);
    if (sp.to) {
      const toDate = new Date(sp.to);
      toDate.setHours(23, 59, 59, 999);
      entryTime.lte = toDate;
    }
    where.entryTime = entryTime;
  }

  const [trades, setups, allTrades] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: { entryTime: "desc" },
      select: {
        id: true,
        symbol: true,
        assetClass: true,
        direction: true,
        status: true,
        setupId: true,
        entryTime: true,
        exitTime: true,
        entryPrice: true,
        exitPrice: true,
        stopLoss: true,
        takeProfit1: true,
        quantity: true,
        commission: true,
        swap: true,
        pnlGross: true,
        pnlNet: true,
        rMultiple: true,
        outcome: true,
        timeframeTrend: true,
        timeframeEntry: true,
        qualityScore: true,
        planAdherence: true,
        emotion: true,
        preTradeNotes: true,
        postTradeNotes: true,
        mistakeNotes: true,
        isFomo: true,
        isRevengeTraded: true,
        isImpulsive: true,
        tags: {
          select: {
            tag: { select: { name: true, color: true } },
          },
        },
        screenshots: {
          select: { id: true, url: true, storageKey: true, filename: true, mimeType: true, sizeBytes: true },
          orderBy: { createdAt: "asc" as const },
        },
      },
    }),
    prisma.setup.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Stats always computed on ALL trades (no filter), for the top KPI bar
    prisma.trade.findMany({
      where: { userId },
      select: { outcome: true, pnlNet: true, rMultiple: true },
    }),
  ]);

  const stats = computeStats(allTrades);
  const isFiltered = !!(sp.symbol || sp.direction || sp.outcome || sp.from || sp.to);

  // Serialize Decimals to plain values for client components
  const tradeRows: TradeRowData[] = trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    assetClass: t.assetClass,
    direction: t.direction as "LONG" | "SHORT",
    status: t.status,
    setupId: t.setupId,
    entryTime: t.entryTime,
    exitTime: t.exitTime,
    entryPrice: t.entryPrice.toNumber(),
    exitPrice: t.exitPrice?.toNumber() ?? null,
    stopLoss: t.stopLoss?.toNumber() ?? null,
    takeProfit: t.takeProfit1?.toNumber() ?? null,
    quantity: t.quantity.toNumber(),
    commission: t.commission?.toNumber() ?? null,
    swap: t.swap?.toNumber() ?? null,
    pnlGross: t.pnlGross?.toNumber() ?? null,
    pnlNet: t.pnlNet?.toNumber() ?? null,
    rMultiple: t.rMultiple?.toNumber() ?? null,
    outcome: t.outcome,
    timeframeTrend: t.timeframeTrend,
    timeframeEntry: t.timeframeEntry,
    qualityScore: t.qualityScore,
    planAdherence: t.planAdherence,
    emotion: t.emotion,
    preTradeNotes: t.preTradeNotes,
    postTradeNotes: t.postTradeNotes,
    mistakeNotes: t.mistakeNotes,
    isFomo: t.isFomo,
    isRevenge: t.isRevengeTraded,
    isImpulsive: t.isImpulsive,
    tags: t.tags.map((tt) => tt.tag.name),
    media: t.screenshots.map((s) => ({
      id: s.id,
      url: s.url,
      filename: s.filename ?? null,
      mimeType: s.mimeType ?? null,
      sizeBytes: s.sizeBytes ?? null,
    })),
  }));

  return (
    <div className="mx-auto max-w-7xl">
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(0,200,150,0.15)" }}
          >
            <TrendingUp size={18} style={{ color: "var(--accent-tertiary-light)" }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              Trade Journal
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {stats.totalAll > 0
                ? `${stats.totalAll} trade${stats.totalAll !== 1 ? "s" : ""} · ${stats.open} open`
                : "Log your live trades"}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI bar — always from all trades ── */}
      {stats.totalAll > 0 ? (
        <div className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-8">
          <KpiCell label="Trades"        value={String(stats.totalAll)}                               neutral />
          <KpiCell label="Win Rate"      value={fmtPct(stats.winrate)}                                positive={(stats.winrate ?? 0) >= 50} />
          <KpiCell label="Profit Factor" value={fmtPF(stats.profitFactor)}                            positive={stats.profitFactor !== null && (isFinite(stats.profitFactor) ? stats.profitFactor >= 1 : true)} />
          <KpiCell label="Expectancy"    value={fmtR(stats.expectancy)}                               positive={(stats.expectancy ?? 0) > 0} />
          <KpiCell label="Total P&L"     value={fmtPnl(stats.totalPnl)}                               positive={stats.totalPnl >= 0} />
          <KpiCell label="Total R"       value={fmtR(stats.totalR)}                                   positive={(stats.totalR ?? 0) > 0} />
          <KpiCell label="Wins"          value={String(stats.wins)}                                   positive sub={`/ ${stats.wins + stats.losses} closed`} />
          <KpiCell label="Losses"        value={String(stats.losses)}                                 positive={false} sub={`${stats.open} open`} />
        </div>
      ) : (
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl px-6 py-4"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <BarChart2 size={16} />
          <p className="text-base">No trades yet. Log your first trade below to start tracking your performance.</p>
        </div>
      )}

      {/* ── P&L strip bar ── */}
      <PnlBar trades={allTrades} />

      {/* ── Trade table ── */}
      <div
        className="mb-6 overflow-hidden rounded-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Table header row */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Trades {isFiltered ? `(${trades.length} filtered)` : `(${trades.length})`}
            </p>
            {trades.length > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1">
                  <TrendingUp size={11} style={{ color: "var(--accent-tertiary-light)" }} />
                  {trades.filter((t) => t.outcome === "WIN").length}W
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown size={11} style={{ color: "#f87171" }} />
                  {trades.filter((t) => t.outcome === "LOSS").length}L
                </span>
              </div>
            )}
          </div>

          {/* Filters (wrapped in Suspense for useSearchParams) */}
          <Suspense fallback={<div className="h-8 w-64 animate-pulse rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.04)" }} />}>
            <TradesFilter />
          </Suspense>
        </div>

        {/* Column headers */}
        {trades.length > 0 && <TableHeader />}

        {/* Rows */}
        {trades.length === 0 ? (
          <div className="py-12 text-center">
            {isFiltered ? (
              <p className="text-base" style={{ color: "var(--text-muted)" }}>
                No trades match the current filters.
              </p>
            ) : (
              <p className="text-base" style={{ color: "var(--text-muted)" }}>
                No trades yet. Use the form below to log your first trade.
              </p>
            )}
          </div>
        ) : (
          <div>
            {tradeRows.map((trade) => (
              <TradeRow key={trade.id} trade={trade} setups={setups} />
            ))}
          </div>
        )}
      </div>

      {/* ── Add Trade panel ── */}
      <AddTradePanel setups={setups} />
    </div>
  );
}
