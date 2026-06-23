import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// M1 bars per higher timeframe
const TF_MINUTES: Record<string, number> = {
  m1: 1, m5: 5, m15: 15, m30: 30, h1: 60, h4: 240, d1: 1440,
};

function aggregateBars(
  m1Bars: { time: number; open: number; high: number; low: number; close: number; volume: number }[],
  tfMinutes: number
) {
  if (tfMinutes === 1) return m1Bars;

  const periodMs = tfMinutes * 60 * 1000;
  const buckets = new Map<number, { open: number; high: number; low: number; close: number; volume: number }>();

  for (const bar of m1Bars) {
    const barMs = bar.time * 1000; // seconds → ms
    const bucketMs = Math.floor(barMs / periodMs) * periodMs;
    const existing = buckets.get(bucketMs);
    if (!existing) {
      buckets.set(bucketMs, { open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
    } else {
      existing.high = Math.max(existing.high, bar.high);
      existing.low = Math.min(existing.low, bar.low);
      existing.close = bar.close;
      existing.volume += bar.volume;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketMs, b]) => ({ time: bucketMs / 1000, ...b }));
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instrument = searchParams.get("instrument");
  const timeframe = searchParams.get("timeframe") ?? "m1";
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  if (!instrument || !from || !to) {
    return NextResponse.json({ error: "Missing params: instrument, from, to" }, { status: 400 });
  }

  const fromNum = Number(from);
  const toNum   = Number(to);
  if (!Number.isInteger(fromNum) || !Number.isInteger(toNum)) {
    return NextResponse.json({ error: "from/to must be integer ms timestamps" }, { status: 400 });
  }

  // Always read M1 from DB, then aggregate to the requested timeframe
  const m1Bars = await prisma.ohlcvBar.findMany({
    where: {
      instrument,
      timeframe: "m1",
      timestamp: { gte: BigInt(fromNum), lte: BigInt(toNum) },
    },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, open: true, high: true, low: true, close: true, volume: true },
  });

  const m1Serialized = m1Bars.map((b) => ({
    time: Number(b.timestamp) / 1000,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  const tfMinutes = TF_MINUTES[timeframe] ?? 1;
  const result = aggregateBars(m1Serialized, tfMinutes);

  return NextResponse.json(result);
}
