import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import {
  FlaskConical, ArrowLeft, CheckCircle, Clock, BarChart2, Minus,
  TrendingUp, TrendingDown,
} from "lucide-react";
import type { BacktestStatus, Direction, TradeOutcome } from "@/generated/prisma/enums";
import { AddTradePanel } from "./AddTradePanel";
import { TradeRow } from "./TradeRow";
import { DeleteButton } from "./DeleteButton";
import { updateBacktestStatus } from "../actions";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

/* ─── Stat helpers ──────────────────────────────────────────────────────── */
function computeStats(trades: {
  outcome: TradeOutcome | null;
  rMultiple: number | null;
  pnlDollars: number | null;
}[]) {
  const closed = trades.filter((t) => t.outcome !== null);
  const total = closed.length;
  if (total === 0) return null;

  const wins = closed.filter((t) => t.outcome === "WIN");
  const losses = closed.filter((t) => t.outcome === "LOSS");
  const winrate = (wins.length / total) * 100;

  const withR = closed.filter((t) => t.rMultiple !== null);
  const sumWinR = wins.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!, 0);
  const sumLossR = Math.abs(losses.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!, 0));
  const totalR = withR.reduce((s, t) => s + t.rMultiple!, 0);
  const avgWinR = wins.filter((t) => t.rMultiple !== null).length > 0
    ? sumWinR / wins.filter((t) => t.rMultiple !== null).length : null;
  const avgLossR = losses.filter((t) => t.rMultiple !== null).length > 0
    ? sumLossR / losses.filter((t) => t.rMultiple !== null).length : null;
  const profitFactor = sumLossR > 0 ? sumWinR / sumLossR : sumWinR > 0 ? Infinity : null;
  const expectancy = withR.length > 0 ? totalR / withR.length : null;

  let peak = 0, maxDD = 0, cumR = 0;
  for (const t of withR) {
    cumR += t.rMultiple!;
    if (cumR > peak) peak = cumR;
    const dd = peak - cumR;
    if (dd > maxDD) maxDD = dd;
  }

  const totalPnl = closed.filter((t) => t.pnlDollars !== null).reduce((s, t) => s + t.pnlDollars!, 0);

  return {
    total,
    wins: wins.length,
    losses: losses.length,
    breakeven: closed.filter((t) => t.outcome === "BREAKEVEN").length,
    winrate,
    profitFactor,
    expectancy,
    totalR,
    avgWinR,
    avgLossR,
    maxDD,
    totalPnl,
    bestR: withR.length > 0 ? Math.max(...withR.map((t) => t.rMultiple!)) : null,
    worstR: withR.length > 0 ? Math.min(...withR.map((t) => t.rMultiple!)) : null,
  };
}

function fmtR(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "R";
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1) + "%";
}
function fmtPF(v: number | null | undefined): string {
  if (v == null) return "—";
  if (!isFinite(v)) return "∞";
  return v.toFixed(2);
}

/* ─── Compact KPI cell ──────────────────────────────────────────────────── */
function KpiCell({
  label, value, positive, neutral,
}: {
  label: string; value: string; positive?: boolean; neutral?: boolean;
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
      className="flex flex-col items-center justify-center rounded-xl px-3 py-2.5 text-center"
      style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
    >
      <p
        className="mb-1 text-xs font-semibold uppercase tracking-widest"
        style={{
          color: "var(--text-muted)",
          fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/* ─── Equity curve mini ─────────────────────────────────────────────────── */
function EquityCurveMini({
  trades,
}: {
  trades: { rMultiple: number | null; outcome: TradeOutcome | null }[];
}) {
  const withR = trades.filter((t) => t.rMultiple !== null && t.outcome !== null);
  if (withR.length === 0) return null;

  // Build cumulative R series
  let cum = 0;
  const points = withR.map((t) => {
    cum += t.rMultiple!;
    return { r: t.rMultiple!, cum };
  });

  const total = points.length;
  const maxAbs = Math.max(...points.map((p) => Math.abs(p.cum)), 0.01);

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl px-5 py-3"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p
          className="text-base font-semibold uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          }}
        >
          Equity curve · {total} trades · {fmtR(cum)} cumulative
        </p>
        <p className="text-sm tabular-nums" style={{ color: cum >= 0 ? "var(--accent-tertiary-light)" : "#f87171" }}>
          {cum >= 0 ? "+" : ""}{cum.toFixed(2)}R
        </p>
      </div>

      {/* Segmented progress bar */}
      <div className="flex h-2 w-full gap-px overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
        {points.map((p, i) => {
          const widthPct = 100 / total;
          const color = p.r > 0 ? "var(--accent-tertiary)" : p.r < 0 ? "#ef4444" : "var(--text-muted)";
          const opacity = 0.5 + 0.5 * (Math.abs(p.r) / (maxAbs / total || 1));
          return (
            <div
              key={i}
              style={{
                width: `${widthPct}%`,
                backgroundColor: color,
                opacity: Math.min(opacity, 1),
                flexShrink: 0,
              }}
              title={`Trade ${i + 1}: ${p.r >= 0 ? "+" : ""}${p.r.toFixed(2)}R (cum: ${fmtR(p.cum)})`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Status badge ──────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: BacktestStatus }) {
  const map: Record<BacktestStatus, { color: string; label: string; icon: React.ReactNode }> = {
    IN_PROGRESS: { color: "var(--accent-secondary-light)", label: "In Progress", icon: <Clock size={11} /> },
    COMPLETED:   { color: "#6ee7b7", label: "Completed", icon: <CheckCircle size={11} /> },
    ARCHIVED:    { color: "var(--text-muted)", label: "Archived", icon: <Minus size={11} /> },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-base font-semibold" style={{ color: s.color }}>
      {s.icon} {s.label}
    </span>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default async function BacktestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const backtest = await prisma.backtest.findFirst({
    where: { id, userId: session.user.id },
    include: {
      setup: { select: { name: true, id: true } },
      trades: {
        orderBy: { tradeNumber: "asc" },
        include: {
          media: {
            select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!backtest) notFound();

  const stats = computeStats(backtest.trades);
  const periodFmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const completeAction = updateBacktestStatus.bind(null, id, "COMPLETED");
  const reopenAction = updateBacktestStatus.bind(null, id, "IN_PROGRESS");

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <Link
          href="/backtest"
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-white/5"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="rounded-lg px-2 py-0.5 text-sm font-bold tracking-wider"
              style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              {backtest.instrument}
            </span>
            {backtest.timeframe && (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {backtest.timeframe}
              </span>
            )}
            <StatusBadge status={backtest.status} />
          </div>
          <h1 className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>
            {backtest.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-lg" style={{ color: "var(--text-muted)" }}>
            <span>{periodFmt(backtest.periodStart)} → {periodFmt(backtest.periodEnd)}</span>
            {backtest.setup && (
              <Link href={`/setups/${backtest.setup.id}`} className="hover:underline" style={{ color: "var(--accent-primary-light)" }}>
                Setup: {backtest.setup.name}
              </Link>
            )}
            <span>Capital: ${backtest.initialCapital.toLocaleString()}</span>
            <span>Risk: {backtest.riskPerTrade}%/trade</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {backtest.status === "IN_PROGRESS" && (
            <form action={completeAction}>
              <PrimaryButton type="submit" size="sm">
                <CheckCircle size={13} /> Mark Complete
              </PrimaryButton>
            </form>
          )}
          {backtest.status === "COMPLETED" && (
            <form action={reopenAction}>
              <PrimaryButton type="submit" size="sm">
                <Clock size={13} /> Reopen
              </PrimaryButton>
            </form>
          )}
          <DeleteButton backtestId={id} />
        </div>
      </div>

      {/* ── KPI bar — 8 cells, single row ── */}
      {stats ? (
        <div className="mb-6 grid grid-cols-8 gap-2">
          <KpiCell label="Trades"      value={String(stats.total)}                                                        neutral />
          <KpiCell label="Winrate"     value={fmtPct(stats.winrate)}                                                      positive={stats.winrate >= 50} />
          <KpiCell label="Prof. Factor" value={fmtPF(stats.profitFactor)}                                                 positive={stats.profitFactor !== null && (isFinite(stats.profitFactor) ? stats.profitFactor >= 1 : true)} />
          <KpiCell label="Expectancy"  value={fmtR(stats.expectancy)}                                                     positive={(stats.expectancy ?? 0) > 0} />
          <KpiCell label="Total R"     value={fmtR(stats.totalR)}                                                         positive={(stats.totalR ?? 0) > 0} />
          <KpiCell label="Avg Win"     value={fmtR(stats.avgWinR)}                                                        positive />
          <KpiCell label="Avg Loss"    value={stats.avgLossR != null ? "-" + stats.avgLossR.toFixed(2) + "R" : "—"}       positive={false} />
          <KpiCell label="Max DD"      value={stats.maxDD > 0 ? "-" + stats.maxDD.toFixed(2) + "R" : "0R"}                positive={stats.maxDD === 0} />
        </div>
      ) : (
        <div
          className="mb-6 flex items-center gap-3 rounded-2xl px-6 py-4"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <BarChart2 size={16} />
          <p className="text-lg">No completed trades yet — add trades to see statistics.</p>
        </div>
      )}

      {/* ── Equity curve mini bar ── */}
      <EquityCurveMini trades={backtest.trades} />

      {/* ── Trade table — full width ── */}
      <div
        className="mb-6 overflow-hidden rounded-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Table header row */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Trades ({backtest.trades.length})
            </p>
            {backtest.trades.length > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1">
                  <TrendingUp size={11} style={{ color: "var(--accent-tertiary-light)" }} />
                  {backtest.trades.filter((t) => t.outcome === "WIN").length}W
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown size={11} style={{ color: "#f87171" }} />
                  {backtest.trades.filter((t) => t.outcome === "LOSS").length}L
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Column headers */}
        {backtest.trades.length > 0 && (
          <div
            className="flex items-center gap-3 border-b px-5 py-2"
            style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.01)" }}
          >
            <span className="w-5 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>#</span>
            <span className="w-14 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Dir.</span>
            <span className="w-20 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Date</span>
            <span className="w-28 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Entry → Exit</span>
            <span className="w-12 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Result</span>
            <span className="w-14 shrink-0 text-right text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>R</span>
            <span className="w-16 shrink-0 text-right text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>P&L $</span>
            <span className="w-16 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Grade</span>
            <span className="flex-1 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Notes</span>
            <span className="ml-auto w-16 shrink-0" />
          </div>
        )}

        {backtest.trades.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>
              No trades yet. Use the form below to add your first trade.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {backtest.trades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={{
                  ...trade,
                  direction: trade.direction as Direction,
                  outcome: trade.outcome as TradeOutcome | null,
                  media: trade.media,
                }}
                backtestId={backtest.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add Trade — collapsible panel ── */}
      <AddTradePanel backtestId={backtest.id} />

      {/* ── Notes ── */}
      {backtest.notes && (
        <div
          className="mt-6 rounded-2xl p-6"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <p className="mb-2 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Notes
          </p>
          <p className="text-lg leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
            {backtest.notes}
          </p>
        </div>
      )}
    </div>
  );
}
