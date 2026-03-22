"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  BacktestStatus, Direction, TradeOutcome, Timeframe,
  MarketSession, IctModel, PoiType, MarketBias, MarketStructure, LiquidityType,
} from "@/generated/prisma/enums";

/* ─── Auth ──────────────────────────────────────────────────────────────── */
async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");
  return session.user.id;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function getString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function getOptional(fd: FormData, key: string): string | null {
  const v = getString(fd, key);
  return v.length > 0 ? v : null;
}
function getFloat(fd: FormData, key: string, fallback: number): number {
  const v = getString(fd, key);
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}
function getOptionalFloat(fd: FormData, key: string): number | null {
  const v = getString(fd, key);
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function getEnum<T extends string>(fd: FormData, key: string, values: readonly T[]): T | null {
  const v = getString(fd, key);
  return (values as unknown as string[]).includes(v) ? (v as T) : null;
}
function getBool(fd: FormData, key: string): boolean {
  return fd.get(key) === "true" || fd.get(key) === "on";
}
function getOptionalBool(fd: FormData, key: string): boolean | null {
  const v = fd.get(key);
  if (v === "true" || v === "on") return true;
  if (v === "false" || v === "off") return false;
  return null;
}

/* ─── createBacktest ────────────────────────────────────────────────────── */
export async function createBacktest(formData: FormData): Promise<void> {
  const userId = await requireUserId();

  const name = getString(formData, "name");
  const instrument = getString(formData, "instrument");
  const periodStartRaw = getString(formData, "periodStart");
  const periodEndRaw = getString(formData, "periodEnd");

  if (!name) throw new Error("Name is required.");
  if (!instrument) throw new Error("Instrument is required.");
  if (!periodStartRaw || !periodEndRaw) throw new Error("Period is required.");

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime()))
    throw new Error("Invalid dates.");
  if (periodEnd < periodStart)
    throw new Error("End date must be after start date.");

  const timeframeRaw = getOptional(formData, "timeframe");
  const setupId = getOptional(formData, "setupId");

  const backtest = await prisma.backtest.create({
    data: {
      userId,
      name,
      instrument: instrument.toUpperCase(),
      timeframe: timeframeRaw ? (timeframeRaw as Timeframe) : null,
      setupId: setupId || null,
      periodStart,
      periodEnd,
      initialCapital: getFloat(formData, "initialCapital", 10000),
      riskPerTrade: getFloat(formData, "riskPerTrade", 1),
      description: getOptional(formData, "description"),
      notes: getOptional(formData, "notes"),
      status: "IN_PROGRESS",
    },
  });

  redirect(`/backtest/${backtest.id}`);
}

/* ─── updateBacktestStatus ──────────────────────────────────────────────── */
export async function updateBacktestStatus(
  backtestId: string,
  status: BacktestStatus
): Promise<void> {
  const userId = await requireUserId();

  await prisma.backtest.updateMany({
    where: { id: backtestId, userId },
    data: { status },
  });

  revalidatePath(`/backtest/${backtestId}`);
  revalidatePath("/backtest");
}

/* ─── deleteBacktest ────────────────────────────────────────────────────── */
export async function deleteBacktest(backtestId: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.backtest.deleteMany({ where: { id: backtestId, userId } });

  redirect("/backtest");
}

/* ─── Shared trade field extractor ─────────────────────────────────────── */
function extractTradeFields(fd: FormData) {
  const directionRaw = getString(fd, "direction");
  if (directionRaw !== "LONG" && directionRaw !== "SHORT")
    throw new Error("Direction must be LONG or SHORT.");

  const entryDateRaw = getString(fd, "entryDate");
  if (!entryDateRaw) throw new Error("Entry date is required.");
  const entryDate = new Date(entryDateRaw);

  const exitDateRaw = getOptional(fd, "exitDate");
  const exitDate = exitDateRaw ? new Date(exitDateRaw) : null;

  const outcomeRaw = getOptional(fd, "outcome");
  const entryPrice = getOptionalFloat(fd, "entryPrice");
  const exitPrice = getOptionalFloat(fd, "exitPrice");
  const stopLoss = getOptionalFloat(fd, "stopLoss");

  let rMultiple = getOptionalFloat(fd, "rMultiple");
  if (rMultiple === null && entryPrice && exitPrice && stopLoss) {
    const risk = Math.abs(entryPrice - stopLoss);
    if (risk > 0) {
      const pnl = directionRaw === "LONG"
        ? exitPrice - entryPrice
        : entryPrice - exitPrice;
      rMultiple = pnl / risk;
    }
  }

  const tagsRaw = getOptional(fd, "tags");
  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const gradeRaw = getOptionalFloat(fd, "grade");

  const SESSIONS    = ["ASIA","LONDON","LONDON_CLOSE","NEW_YORK_AM","NEW_YORK_PM","SILVER_BULLET_AM","SILVER_BULLET_PM","OVERLAP","OFF_HOURS"] as const;
  const ICT_MODELS  = ["ICT_2022","SILVER_BULLET","JUDAS_SWING","LONDON_OPEN_RECAP","POWER_OF_3","BREAKER_BLOCK","MITIGATION_BLOCK","PROPULSION_BLOCK","FVG_FILL","OTE","TURTLE_SOUP","SCALP","OTHER"] as const;
  const POI_TYPES   = ["ORDER_BLOCK_BULL","ORDER_BLOCK_BEAR","BREAKER_BLOCK_BULL","BREAKER_BLOCK_BEAR","FVG_BULL","FVG_BEAR","IFVG_BULL","IFVG_BEAR","MITIGATION_BLOCK_BULL","MITIGATION_BLOCK_BEAR","LIQUIDITY_VOID","PREMIUM_ARRAY","DISCOUNT_ARRAY","EQUILIBRIUM","WEEKLY_OPEN","DAILY_OPEN","MIDNIGHT_OPEN","LONDON_OPEN","ASIA_HIGH","ASIA_LOW","PREV_DAY_HIGH","PREV_DAY_LOW","PREV_WEEK_HIGH","PREV_WEEK_LOW"] as const;
  const BIASES      = ["BULLISH","BEARISH","NEUTRAL"] as const;
  const STRUCTURES  = ["HH_HL","LH_LL","RANGE","BOS_UP","BOS_DOWN","CHOCH_UP","CHOCH_DOWN"] as const;
  const LIQUIDITIES = ["BSL","SSL","BOTH","NONE"] as const;
  const TIMEFRAMES  = ["M1","M5","M15","M30","H1","H4","D1","W1","MN"] as const;

  return {
    direction:      directionRaw as Direction,
    entryDate,
    exitDate,
    entryPrice:     entryPrice ?? 0,
    exitPrice,
    stopLoss,
    takeProfit:     getOptionalFloat(fd, "takeProfit"),
    outcome:        outcomeRaw ? (outcomeRaw as TradeOutcome) : null,
    rMultiple,
    pnlPoints:      getOptionalFloat(fd, "pnlPoints"),
    pnlDollars:     getOptionalFloat(fd, "pnlDollars"),
    quantity:       getFloat(fd, "quantity", 1),
    grade:          gradeRaw ? Math.round(gradeRaw) : null,
    notes:          getOptional(fd, "notes"),
    screenshotUrl:  getOptional(fd, "screenshotUrl"),
    tags,
    // Context
    marketSession:   getEnum(fd, "marketSession", SESSIONS) as MarketSession | null,
    timeframeEntry:  getEnum(fd, "timeframeEntry", TIMEFRAMES) as Timeframe | null,
    timeframeTrend:  getEnum(fd, "timeframeTrend", TIMEFRAMES) as Timeframe | null,
    ictModel:        getEnum(fd, "ictModel", ICT_MODELS) as IctModel | null,
    poi:             getEnum(fd, "poi", POI_TYPES) as PoiType | null,
    biasHTF:         getEnum(fd, "biasHTF", BIASES) as MarketBias | null,
    biasMTF:         getEnum(fd, "biasMTF", BIASES) as MarketBias | null,
    marketStructure: getEnum(fd, "marketStructure", STRUCTURES) as MarketStructure | null,
    liquiditySwept:  getEnum(fd, "liquiditySwept", LIQUIDITIES) as LiquidityType | null,
    // Psychology
    isFomo:        getBool(fd, "isFomo"),
    isRevenge:     getBool(fd, "isRevenge"),
    isImpulsive:   getBool(fd, "isImpulsive"),
    followedRules: getOptionalBool(fd, "followedRules"),
  };
}

/* ─── addBacktestTrade ──────────────────────────────────────────────────── */
// Returns the new trade's ID so the client can upload media against it.
// tempStorageKeys: R2 keys of images uploaded before the trade existed (tradeId="temp").
// They are moved to the correct path and persisted as BacktestTradeMedia rows.
export async function addBacktestTrade(
  backtestId: string,
  formData: FormData,
  tempStorageKeys: string[] = []
): Promise<string> {
  const userId = await requireUserId();

  const backtest = await prisma.backtest.findFirst({
    where: { id: backtestId, userId },
    select: { id: true },
  });
  if (!backtest) throw new Error("Backtest not found.");

  const fields = extractTradeFields(formData);
  const count = await prisma.backtestTrade.count({ where: { backtestId } });

  const trade = await prisma.backtestTrade.create({
    data: {
      backtestId,
      tradeNumber: count + 1,
      ...fields,
      // Attach any temp-uploaded media rows in the same transaction
      ...(tempStorageKeys.length > 0 && {
        media: {
          create: tempStorageKeys.map((storageKey) => ({
            url: `${process.env.R2_PUBLIC_URL?.replace(/\/$/, "")}/${storageKey}`,
            storageKey,
          })),
        },
      }),
    },
    select: { id: true },
  });

  revalidatePath(`/backtest/${backtestId}`);
  return trade.id;
}

/* ─── updateBacktestTrade ───────────────────────────────────────────────── */
export async function updateBacktestTrade(
  backtestId: string,
  tradeId: string,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();

  const backtest = await prisma.backtest.findFirst({
    where: { id: backtestId, userId },
    select: { id: true },
  });
  if (!backtest) throw new Error("Backtest not found.");

  const fields = extractTradeFields(formData);

  await prisma.backtestTrade.update({
    where: { id: tradeId },
    data: fields,
  });

  revalidatePath(`/backtest/${backtestId}`);
}

/* ─── deleteBacktestTrade ───────────────────────────────────────────────── */
export async function deleteBacktestTrade(
  backtestId: string,
  tradeId: string
): Promise<void> {
  const userId = await requireUserId();

  const backtest = await prisma.backtest.findFirst({
    where: { id: backtestId, userId },
    select: { id: true },
  });
  if (!backtest) throw new Error("Backtest not found.");

  await prisma.backtestTrade.delete({ where: { id: tradeId } });

  // Re-number remaining trades
  const remaining = await prisma.backtestTrade.findMany({
    where: { backtestId },
    orderBy: { tradeNumber: "asc" },
    select: { id: true },
  });
  await Promise.all(
    remaining.map((t, i) =>
      prisma.backtestTrade.update({
        where: { id: t.id },
        data: { tradeNumber: i + 1 },
      })
    )
  );

  revalidatePath(`/backtest/${backtestId}`);
}
