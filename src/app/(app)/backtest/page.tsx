import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { FlaskConical, Plus, ChevronRight, TrendingUp, Clock } from "lucide-react";
import type { BacktestStatus } from "@/generated/prisma/enums";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface BacktestStats {
  total: number;
  wins: number;
  losses: number;
  winrate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  totalR: number | null;
}

/* ─── Stat helpers ──────────────────────────────────────────────────────── */
function computeStats(
  trades: { outcome: string | null; rMultiple: number | null }[]
): BacktestStats {
  const closed = trades.filter((t) => t.outcome !== null);
  const total = closed.length;
  if (total === 0)
    return { total: 0, wins: 0, losses: 0, winrate: null, profitFactor: null, expectancy: null, totalR: null };

  const wins = closed.filter((t) => t.outcome === "WIN").length;
  const losses = closed.filter((t) => t.outcome === "LOSS").length;
  const winrate = (wins / total) * 100;

  const withR = closed.filter((t) => t.rMultiple !== null);
  const sumWinR = withR.filter((t) => (t.rMultiple ?? 0) > 0).reduce((s, t) => s + (t.rMultiple ?? 0), 0);
  const sumLossR = Math.abs(withR.filter((t) => (t.rMultiple ?? 0) < 0).reduce((s, t) => s + (t.rMultiple ?? 0), 0));
  const totalR = withR.reduce((s, t) => s + (t.rMultiple ?? 0), 0);

  const profitFactor = sumLossR > 0 ? sumWinR / sumLossR : sumWinR > 0 ? Infinity : null;
  const expectancy = withR.length > 0 ? totalR / withR.length : null;

  return { total, wins, losses, winrate, profitFactor, expectancy, totalR };
}

function fmtR(v: number | null): string {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "R";
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(1) + "%";
}

function fmtPF(v: number | null): string {
  if (v === null) return "—";
  if (!isFinite(v)) return "∞";
  return v.toFixed(2);
}

/* ─── Status badge ──────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: BacktestStatus }) {
  const styles: Record<BacktestStatus, { bg: string; border: string; text: string; label: string }> = {
    IN_PROGRESS: { bg: "rgba(255,140,0,0.12)", border: "rgba(255,140,0,0.35)", text: "var(--accent-secondary-light)", label: "In Progress" },
    COMPLETED:   { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#6ee7b7", label: "Completed" },
    ARCHIVED:    { bg: "rgba(255,255,255,0.05)", border: "var(--border)", text: "var(--text-muted)", label: "Archived" },
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold uppercase tracking-wider"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.text }} />
      {s.label}
    </span>
  );
}

/* ─── Backtest card ─────────────────────────────────────────────────────── */
function BacktestCard({
  backtest,
  setupName,
  tradeCount,
  stats,
}: {
  backtest: {
    id: string;
    name: string;
    instrument: string;
    timeframe: string | null;
    periodStart: Date;
    periodEnd: Date;
    status: BacktestStatus;
    updatedAt: Date;
  };
  setupName: string | null;
  tradeCount: number;
  stats: BacktestStats;
}) {
  const periodFmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <Link
      href={`/backtest/${backtest.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl p-6 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.02] focus-visible:ring-2"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Corner glow */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full blur-2xl"
        style={{ backgroundColor: "rgba(99,102,241,0.08)" }}
      />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            <span
              className="rounded-lg px-2 py-0.5 text-xs font-bold tracking-wider"
              style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
            >
              {backtest.instrument}
            </span>
            {backtest.timeframe && (
              <span
                className="rounded-lg px-2 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                {backtest.timeframe.replace("M", "").replace("H", "H").replace("D1", "Daily").replace("W1", "Weekly")}
              </span>
            )}
          </div>
          <h3 className="truncate text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {backtest.name}
          </h3>
          {setupName && (
            <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
              Setup: <span style={{ color: "var(--accent-primary-light)" }}>{setupName}</span>
            </p>
          )}
        </div>
        <StatusBadge status={backtest.status} />
      </div>

      {/* Period + trade count */}
      <div className="mb-4 flex items-center gap-4 text-sm" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {periodFmt(backtest.periodStart)} → {periodFmt(backtest.periodEnd)}
        </span>
        <span>{tradeCount} trade{tradeCount !== 1 ? "s" : ""}</span>
      </div>
      {/* Stats grid */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: "Winrate", value: fmtPct(stats.winrate), positive: stats.winrate !== null && stats.winrate >= 50 },
          { label: "Prof. Factor", value: fmtPF(stats.profitFactor), positive: stats.profitFactor !== null && stats.profitFactor >= 1 },
          { label: "Expectancy", value: fmtR(stats.expectancy), positive: stats.expectancy !== null && stats.expectancy > 0 },
          { label: "Total R", value: fmtR(stats.totalR), positive: stats.totalR !== null && stats.totalR > 0 },
        ].map(({ label, value, positive }) => (
          <div key={label} className="text-center">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              {label}
            </p>
            <p
              className="text-base font-bold tabular-nums"
              style={{
                color:
                  value === "—"
                    ? "var(--text-muted)"
                    : positive
                    ? "var(--accent-tertiary-light)"
                    : "#f87171",
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Winrate bar */}
      {stats.winrate !== null && (
        <div className="mb-1 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--border)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(stats.winrate, 100)}%`,
              backgroundColor: stats.winrate >= 50 ? "var(--accent-tertiary-light)" : "#f87171",
            }}
          />
        </div>
      )}

      {/* Arrow */}
      <ChevronRight
        size={14}
        className="absolute bottom-5 right-5 opacity-0 transition-all duration-150 group-hover:opacity-60 group-hover:translate-x-0.5"
        style={{ color: "var(--text-muted)" }}
      />
    </Link>
  );
}

/* ─── Empty state ───────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}
      >
        <FlaskConical size={26} style={{ color: "#a5b4fc" }} />
      </div>
      <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        No backtests yet
      </h3>
      <p className="mb-8 max-w-xs text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Create your first backtest to start validating your trading setups.
      </p>
      <Link
        href="/backtest/new"
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-base font-semibold transition-all hover:opacity-90"
        style={{ backgroundColor: "var(--accent-primary)", color: "#1a1710" }}
      >
        <Plus size={16} />
        New Backtest
      </Link>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default async function BacktestPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const backtests = await prisma.backtest.findMany({
    where: { userId, status: { not: "ARCHIVED" } },
    include: {
      setup: { select: { name: true } },
      trades: { select: { outcome: true, rMultiple: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(99,102,241,0.18)" }}
          >
            <FlaskConical size={18} style={{ color: "#a5b4fc" }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              Backtest
            </h1>
            <p className="text-base" style={{ color: "var(--text-secondary)" }}>
              {backtests.length > 0
                ? `${backtests.length} backtest${backtests.length > 1 ? "s" : ""}`
                : "Validate your setups on historical data"}
            </p>
          </div>
        </div>

        <Link
          href="/backtest/new"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--accent-primary)", color: "#1a1710" }}
        >
          <Plus size={16} />
          New Backtest
        </Link>
      </div>

      {backtests.length === 0 ? (
        <div
          className="rounded-2xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <EmptyState />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {backtests.map((bt) => (
            <BacktestCard
              key={bt.id}
              backtest={bt}
              setupName={bt.setup?.name ?? null}
              tradeCount={bt.trades.length}
              stats={computeStats(bt.trades)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
