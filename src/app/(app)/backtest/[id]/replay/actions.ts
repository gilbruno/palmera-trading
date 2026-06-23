"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { FilledTrade } from "./useReplayEngine";

export async function createReplayTrade(
  backtestId: string,
  trade: FilledTrade,
  notes: string
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
      direction:    trade.order.direction,
      outcome:      trade.outcome,
      entryDate:    new Date(trade.entryBar.time * 1000),
      exitDate:     new Date(trade.exitBar.time * 1000),
      entryPrice:   trade.order.entryPrice,
      exitPrice:    trade.exitPrice,
      stopLoss:     trade.order.stopLoss,
      takeProfit:   trade.order.takeProfit,
      rMultiple:    trade.rMultiple,
      pnlPoints:    trade.pnlPoints,
      notes:        notes.trim() || null,
    },
    select: { id: true },
  });

  revalidatePath(`/backtest/${backtestId}`);
  return created.id;
}
