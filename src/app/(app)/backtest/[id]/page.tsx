import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, Minus } from "lucide-react";
import type { BacktestStatus, Direction, TradeOutcome } from "@/generated/prisma/enums";
import { AddTradePanel } from "./AddTradePanel";
import { DeleteButton } from "./DeleteButton";
import { updateBacktestStatus } from "../actions";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { BacktestScenarioView } from "./BacktestScenarioView";

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

      {/* ── KPI bar + Equity curve + Trade table (client, with scenario selector) ── */}
      <BacktestScenarioView
        instrument={backtest.instrument}
        trades={backtest.trades.map((t) => ({
          ...t,
          direction: t.direction as Direction,
          outcome:   t.outcome   as TradeOutcome | null,
          outcome1R:  t.outcome1R  as TradeOutcome | null,
          outcome15R: t.outcome15R as TradeOutcome | null,
          media: t.media,
        }))}
        backtestId={backtest.id}
      />

      {/* ── Add Trade — collapsible panel ── */}
      <AddTradePanel backtestId={backtest.id} instrument={backtest.instrument} />

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
