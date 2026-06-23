"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type TradeEntry = {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryDate: Date;
};

export type TradeExit = {
  exitPrice: number;
  exitDate: Date;
  outcome: "WIN" | "LOSS";
  rMultiple: number;
  pnlPoints: number;
};

export async function createReplayTrade(
  backtestId: string,
  entry: TradeEntry
): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const backtest = await prisma.backtest.findFirst({
    where: { id: backtestId, userId: session.user.id },
    select: { id: true },
  });
  if (!backtest) throw new Error("Backtest not found.");

  const max = await prisma.backtestTrade.aggregate({
    where: { backtestId },
    _max: { tradeNumber: true },
  });
  const tradeNumber = (max._max.tradeNumber ?? 0) + 1;

  const created = await prisma.backtestTrade.create({
    data: {
      backtestId,
      tradeNumber,
      direction:  entry.direction,
      entryDate:  entry.entryDate,
      entryPrice: entry.entryPrice,
      stopLoss:   entry.stopLoss,
      takeProfit: entry.takeProfit,
      // exit fields left null — filled in by updateReplayTrade
    },
    select: { id: true },
  });

  revalidatePath(`/backtest/${backtestId}`);
  return created.id;
}

export async function updateReplayTrade(
  tradeId: string,
  exit: TradeExit,
  notes: string
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  await prisma.backtestTrade.update({
    where: { id: tradeId },
    data: {
      exitDate:  exit.exitDate,
      exitPrice: exit.exitPrice,
      outcome:   exit.outcome,
      rMultiple: exit.rMultiple,
      pnlPoints: exit.pnlPoints,
      notes:     notes.trim() || null,
    },
  });

  // Récupérer le backtestId pour revalidatePath
  const trade = await prisma.backtestTrade.findUnique({
    where: { id: tradeId },
    select: { backtestId: true },
  });
  if (trade) revalidatePath(`/backtest/${trade.backtestId}`);
}
