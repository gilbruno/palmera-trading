"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type TradeEntry = {
  direction: "LONG" | "SHORT";
  orderType: "MARKET" | "LIMIT" | "STOP";
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

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const created = await prisma.backtestTrade.create({
    data: {
      backtestId,
      tradeNumber,
      direction:  entry.direction,
      orderType:  entry.orderType,
      entryDate:  entry.entryDate,
      entryPrice: r2(entry.entryPrice),
      stopLoss:   r2(entry.stopLoss),
      takeProfit: r2(entry.takeProfit),
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

  const trade = await prisma.backtestTrade.findUnique({
    where: { id: tradeId },
    select: { backtestId: true, backtest: { select: { userId: true } } },
  });
  if (!trade || trade.backtest.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  await prisma.backtestTrade.update({
    where: { id: tradeId },
    data: {
      exitDate:  exit.exitDate,
      exitPrice: r2(exit.exitPrice),
      outcome:   exit.outcome,
      rMultiple: exit.rMultiple,
      pnlPoints: exit.pnlPoints,
      notes:     notes.trim() || null,
    },
  });

  revalidatePath(`/backtest/${trade.backtestId}`);
}

export async function updateOrderLevels(
  tradeId: string,
  sl: number,
  tp: number
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const trade = await prisma.backtestTrade.findUnique({
    where: { id: tradeId },
    select: { backtestId: true, backtest: { select: { userId: true } } },
  });
  if (!trade || trade.backtest.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.backtestTrade.update({
    where: { id: tradeId },
    data: { stopLoss: r2(sl), takeProfit: r2(tp) },
  });

  revalidatePath(`/backtest/${trade.backtestId}`);
}
