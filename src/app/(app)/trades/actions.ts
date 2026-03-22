"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  Direction,
  TradeOutcome,
  TradeStatus,
  AssetClass,
  Timeframe,
  PlanAdherence,
  EmotionLevel,
} from "@/generated/prisma/enums";

/* ─── Auth guard ────────────────────────────────────────────────────────── */
async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");
  return session.user.id;
}

/* ─── FormData helpers ──────────────────────────────────────────────────── */
function getString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function getOptional(fd: FormData, key: string): string | null {
  const v = getString(fd, key);
  return v.length > 0 ? v : null;
}

function getFloat(fd: FormData, key: string, fallback: number): number {
  const n = parseFloat(getString(fd, key));
  return isNaN(n) ? fallback : n;
}

function getOptionalFloat(fd: FormData, key: string): number | null {
  const n = parseFloat(getString(fd, key));
  return isNaN(n) ? null : n;
}

function getEnum<T extends string>(
  fd: FormData,
  key: string,
  values: readonly T[]
): T | null {
  const v = getString(fd, key);
  return (values as unknown as string[]).includes(v) ? (v as T) : null;
}

function getBool(fd: FormData, key: string): boolean {
  return fd.get(key) === "true" || fd.get(key) === "on";
}

/* ─── Enum value arrays (for getEnum validation) ────────────────────────── */
const ASSET_CLASSES = [
  "FOREX","CRYPTO","STOCKS","FUTURES","OPTIONS","CFD","COMMODITIES","INDICES","BONDS",
] as const;

const STATUSES = ["OPEN","PARTIAL","CLOSED","CANCELLED"] as const;

const TIMEFRAMES = [
  "M1","M5","M15","M30","H1","H4","D1","W1","MN",
] as const;

const PLAN_ADHERENCES = ["YES","PARTIAL","NO"] as const;

const EMOTIONS = [
  "CONFIDENT","CALM","NEUTRAL","ANXIOUS","FEARFUL","GREEDY","FRUSTRATED","EUPHORIC",
] as const;

const OUTCOMES = ["WIN","LOSS","BREAKEVEN"] as const;

/* ─── Extract & validate trade fields from FormData ────────────────────── */
function extractFields(fd: FormData) {
  const directionRaw = getString(fd, "direction");
  if (directionRaw !== "LONG" && directionRaw !== "SHORT")
    throw new Error("Direction must be LONG or SHORT.");

  const entryTimeRaw = getString(fd, "entryTime");
  if (!entryTimeRaw) throw new Error("Entry time is required.");
  const entryTime = new Date(entryTimeRaw);
  if (isNaN(entryTime.getTime())) throw new Error("Invalid entry time.");

  const entryPriceRaw = getOptionalFloat(fd, "entryPrice");
  if (entryPriceRaw === null) throw new Error("Entry price is required.");

  const exitTimeRaw = getOptional(fd, "exitTime");
  const exitTime = exitTimeRaw ? new Date(exitTimeRaw) : null;
  if (exitTime && isNaN(exitTime.getTime())) throw new Error("Invalid exit time.");

  const symbol = getString(fd, "symbol");
  if (!symbol) throw new Error("Symbol is required.");

  const exitPrice = getOptionalFloat(fd, "exitPrice");
  const stopLoss = getOptionalFloat(fd, "stopLoss");
  const takeProfit1 = getOptionalFloat(fd, "takeProfit");
  const quantity = getFloat(fd, "quantity", 1);

  // Auto-compute R-multiple if not provided
  let rMultiple = getOptionalFloat(fd, "rMultiple");
  if (rMultiple === null && exitPrice !== null && stopLoss !== null) {
    const risk = Math.abs(entryPriceRaw - stopLoss);
    if (risk > 0) {
      const pnl =
        directionRaw === "LONG"
          ? exitPrice - entryPriceRaw
          : entryPriceRaw - exitPrice;
      rMultiple = pnl / risk;
    }
  }

  // Auto-compute P&L gross if entry, exit and quantity are all present
  let pnlGross = getOptionalFloat(fd, "pnlGross");
  if (pnlGross === null && exitPrice !== null) {
    const raw =
      directionRaw === "LONG"
        ? (exitPrice - entryPriceRaw) * quantity
        : (entryPriceRaw - exitPrice) * quantity;
    pnlGross = raw;
  }

  const commission = getOptionalFloat(fd, "commission");
  const swap = getOptionalFloat(fd, "swap");
  let pnlNet = getOptionalFloat(fd, "pnlNet");
  if (pnlNet === null && pnlGross !== null) {
    pnlNet = pnlGross - (commission ?? 0) - (swap ?? 0);
  }

  // Duration in seconds
  let durationSec: number | null = null;
  if (entryTime && exitTime) {
    durationSec = Math.round((exitTime.getTime() - entryTime.getTime()) / 1000);
  }

  const gradeRaw = getOptionalFloat(fd, "qualityScore");

  // Auto-determine outcome if not explicitly set but pnlNet is known
  let outcomeRaw = getEnum(fd, "outcome", OUTCOMES) as TradeOutcome | null;
  if (!outcomeRaw && pnlNet !== null) {
    if (pnlNet > 0) outcomeRaw = "WIN";
    else if (pnlNet < 0) outcomeRaw = "LOSS";
    else outcomeRaw = "BREAKEVEN";
  }

  // Auto status: CLOSED if exit time and price both provided
  const statusRaw = exitTime && exitPrice !== null ? "CLOSED" : (
    getEnum(fd, "status", STATUSES) as TradeStatus | null ?? "OPEN"
  );

  return {
    symbol: symbol.toUpperCase(),
    assetClass: (getEnum(fd, "assetClass", ASSET_CLASSES) as AssetClass | null) ?? "FOREX",
    direction: directionRaw as Direction,
    status: statusRaw as TradeStatus,
    setupId: getOptional(fd, "setupId"),
    entryTime,
    exitTime,
    durationSec,
    entryPrice: entryPriceRaw,
    exitPrice,
    stopLoss,
    takeProfit1,
    quantity,
    accountCurrency: getOptional(fd, "accountCurrency") ?? "USD",
    riskPercent: getOptionalFloat(fd, "riskPercent"),
    riskAmount: getOptionalFloat(fd, "riskAmount"),
    pnlGross,
    pnlNet,
    commission,
    swap,
    rMultiple,
    outcome: outcomeRaw,
    timeframeTrend: getEnum(fd, "timeframeTrend", TIMEFRAMES) as Timeframe | null,
    timeframeEntry: getEnum(fd, "timeframeEntry", TIMEFRAMES) as Timeframe | null,
    qualityScore: gradeRaw ? Math.round(gradeRaw) : null,
    planAdherence: getEnum(fd, "planAdherence", PLAN_ADHERENCES) as PlanAdherence | null,
    emotion: getEnum(fd, "emotion", EMOTIONS) as EmotionLevel | null,
    preTradeNotes: getOptional(fd, "preTradeNotes"),
    postTradeNotes: getOptional(fd, "postTradeNotes"),
    mistakeNotes: getOptional(fd, "mistakeNotes"),
    isFomo: getBool(fd, "isFomo"),
    isRevengeTraded: getBool(fd, "isRevenge"),
    isImpulsive: getBool(fd, "isImpulsive"),
    brokerTradeId: getOptional(fd, "brokerTradeId"),
    brokerName: getOptional(fd, "brokerName"),
  };
}

/* ─── Sync tags for a trade ─────────────────────────────────────────────── */
// Parses the "tags" form field (comma-separated), upserts Tag records for the
// user, then replaces all TradeTag rows for the given trade.
async function syncTags(
  userId: string,
  tradeId: string,
  fd: FormData
): Promise<void> {
  const raw = fd.get("tags");
  const names: string[] =
    typeof raw === "string" && raw.trim().length > 0
      ? raw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  // Delete all existing tag associations for this trade
  await prisma.tradeTag.deleteMany({ where: { tradeId } });

  if (names.length === 0) return;

  // Upsert each tag and connect to the trade
  for (const name of names) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
      select: { id: true },
    });
    await prisma.tradeTag.create({ data: { tradeId, tagId: tag.id } });
  }
}

/* ─── createTrade ────────────────────────────────────────────────────────── */
// Returns the new trade's ID so the client can upload media against it.
// tempStorageKeys: R2 keys uploaded before the trade existed (tradeId="temp").
export async function createTrade(
  formData: FormData,
  tempStorageKeys: string[] = []
): Promise<string> {
  const userId = await requireUserId();
  const fields = extractFields(formData);

  const trade = await prisma.trade.create({
    data: {
      userId,
      ...fields,
      ...(tempStorageKeys.length > 0 && {
        screenshots: {
          create: tempStorageKeys.map((storageKey) => ({
            url: `${process.env.R2_PUBLIC_URL?.replace(/\/$/, "")}/${storageKey}`,
            storageKey,
          })),
        },
      }),
    },
    select: { id: true },
  });

  await syncTags(userId, trade.id, formData);

  revalidatePath("/trades");
  return trade.id;
}

/* ─── updateTrade ────────────────────────────────────────────────────────── */
export async function updateTrade(
  tradeId: string,
  formData: FormData
): Promise<void> {
  const userId = await requireUserId();

  const existing = await prisma.trade.findFirst({
    where: { id: tradeId, userId },
    select: { id: true },
  });
  if (!existing) throw new Error("Trade not found.");

  const fields = extractFields(formData);

  await prisma.trade.update({
    where: { id: tradeId },
    data: fields,
  });

  await syncTags(userId, tradeId, formData);

  revalidatePath("/trades");
}

/* ─── deleteTrade ────────────────────────────────────────────────────────── */
export async function deleteTrade(tradeId: string): Promise<void> {
  const userId = await requireUserId();

  await prisma.trade.deleteMany({
    where: { id: tradeId, userId },
  });

  revalidatePath("/trades");
}
