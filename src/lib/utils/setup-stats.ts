import type { TradeOutcome } from "@/generated/prisma/enums";
import type * as runtime from "@prisma/client/runtime/client";

export interface TradeMetrics {
  id: string;
  outcome: TradeOutcome | null;
  pnlNet: runtime.Decimal | null;
  rMultiple: runtime.Decimal | null;
}

export interface SetupPerformance {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  avgRMultiple: number | null;
  totalR: number;
  profitFactor: number | null;
  expectancy: number | null;
  totalPnl: number;
}

export function calculateSetupPerformance(trades: TradeMetrics[]): SetupPerformance {
  const closed = trades.filter((t) => t.outcome !== null);
  const total = closed.length;

  const wins = closed.filter((t) => t.outcome === "WIN");
  const losses = closed.filter((t) => t.outcome === "LOSS");
  const breakeven = closed.filter((t) => t.outcome === "BREAKEVEN");

  // Calculate total P&L
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnlNet?.toNumber() ?? 0), 0);

  // Calculate R metrics
  const withR = closed.filter((t) => t.rMultiple !== null);
  const sumWinR = wins.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!.toNumber(), 0);
  const sumLossR = Math.abs(losses.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!.toNumber(), 0));

  const profitFactor = sumLossR > 0 ? sumWinR / sumLossR : sumWinR > 0 ? Infinity : null;
  const totalR = withR.reduce((s, t) => s + t.rMultiple!.toNumber(), 0);
  const avgRMultiple = withR.length > 0 ? totalR / withR.length : null;
  const expectancy = withR.length > 0 ? totalR / withR.length : null;

  const winRate = total > 0 ? (wins.length / total) * 100 : null;

  return {
    totalTrades: trades.length,
    closedTrades: total,
    openTrades: trades.filter((t) => t.outcome === null).length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate,
    avgRMultiple,
    totalR,
    profitFactor,
    expectancy,
    totalPnl,
  };
}
