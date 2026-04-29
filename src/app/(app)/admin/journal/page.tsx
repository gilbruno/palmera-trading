import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookOpen } from "lucide-react";
import { Suspense } from "react";
import type { TradeOutcome } from "@/generated/prisma/enums";
import { AdminJournalClient } from "./AdminJournalClient";
import type { TradeRowData } from "@/app/(app)/trades/TradeRow";

interface PageProps {
  searchParams: Promise<{ userId?: string }>;
}

function computeStats(trades: Array<{ outcome: TradeOutcome | null; pnlNet: { toNumber(): number } | null; rMultiple: { toNumber(): number } | null }>) {
  const closed = trades.filter((t) => t.outcome !== null);
  const wins = closed.filter((t) => t.outcome === "WIN");
  const losses = closed.filter((t) => t.outcome === "LOSS");
  const total = closed.length;
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnlNet?.toNumber() ?? 0), 0);
  const withR = closed.filter((t) => t.rMultiple !== null);
  const sumWinR = wins.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!.toNumber(), 0);
  const sumLossR = Math.abs(losses.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!.toNumber(), 0));
  const profitFactor = sumLossR > 0 ? sumWinR / sumLossR : sumWinR > 0 ? Infinity : null;
  const totalR = withR.reduce((s, t) => s + t.rMultiple!.toNumber(), 0);
  const expectancy = withR.length > 0 ? totalR / withR.length : null;

  return {
    totalAll: trades.length,
    open: trades.filter((t) => t.outcome === null).length,
    wins: wins.length,
    losses: losses.length,
    winrate: total > 0 ? (wins.length / total) * 100 : null,
    profitFactor,
    expectancy,
    totalPnl,
    totalR,
  };
}

export default async function AdminJournalPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const selectedUserId = sp.userId ?? null;

  // All non-admin users for the dropdown
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: { id: true, name: true, email: true, _count: { select: { trades: true } } },
    orderBy: { name: "asc" },
  });

  const userOptions = users.map((u) => ({
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    tradeCount: u._count.trades,
  }));

  let trades: TradeRowData[] = [];
  let setups: { id: string; name: string }[] = [];
  let stats: ReturnType<typeof computeStats> | null = null;

  if (selectedUserId) {
    const [rawTrades, rawSetups, allTrades] = await Promise.all([
      prisma.trade.findMany({
        where: { userId: selectedUserId },
        orderBy: { entryTime: "desc" },
        select: {
          id: true, symbol: true, assetClass: true, direction: true, status: true,
          setupId: true, entryTime: true, exitTime: true, entryPrice: true,
          exitPrice: true, stopLoss: true, takeProfit1: true, quantity: true,
          commission: true, swap: true, pnlGross: true, pnlNet: true,
          rMultiple: true, outcome: true, timeframeTrend: true, timeframeEntry: true,
          qualityScore: true, planAdherence: true, emotion: true,
          preTradeNotes: true, postTradeNotes: true, mistakeNotes: true,
          isFomo: true, isRevengeTraded: true, isImpulsive: true,
          tags: { select: { tag: { select: { name: true, color: true } } } },
          screenshots: {
            select: { id: true, url: true, storageKey: true, filename: true, mimeType: true, sizeBytes: true },
            orderBy: { createdAt: "asc" as const },
          },
        },
      }),
      prisma.setup.findMany({
        where: { userId: selectedUserId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.trade.findMany({
        where: { userId: selectedUserId },
        select: { outcome: true, pnlNet: true, rMultiple: true },
      }),
    ]);

    trades = rawTrades.map((t) => ({
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

    setups = rawSetups;
    stats = computeStats(allTrades);
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* ── Header ── */}
      <div className="mb-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
          Administration
        </p>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(245,197,24,0.15)" }}
          >
            <BookOpen size={18} style={{ color: "#F5C518" }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Journal des utilisateurs
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              Consultez le journal de trading de n&apos;importe quel utilisateur
            </p>
          </div>
        </div>
      </div>

      {/* ── Client component ── */}
      <Suspense>
        <AdminJournalClient
          users={userOptions}
          selectedUserId={selectedUserId}
          trades={trades}
          setups={setups}
          stats={stats}
        />
      </Suspense>
    </div>
  );
}
