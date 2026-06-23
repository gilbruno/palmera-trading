// src/app/api/ohlcv/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getHistoricalRates } from "dukascopy-node";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const INSTRUMENT_MAP: Record<string, string> = {
  EURUSD: "eurusd",
  GBPUSD: "gbpusd",
  XAUUSD: "xauusd",
  NQ: "usatechidxusd",
  "NQ!": "usatechidxusd",
  MNQ: "usatechidxusd",
  "MNQ!": "usatechidxusd",
  US100: "usatechidxusd",
  ES: "usa500idxusd",
  "ES!": "usa500idxusd",
  MES: "usa500idxusd",
  "MES!": "usa500idxusd",
  SPX500: "usa500idxusd",
};

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { instrument, month, timeframe = "m1" } = body as {
    instrument: string;
    month: string; // "YYYY-MM"
    timeframe?: string;
  };

  if (!instrument || !month) {
    return NextResponse.json(
      { error: "instrument and month are required" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const dukascopyInstrument = INSTRUMENT_MAP[instrument];
  if (!dukascopyInstrument) {
    return NextResponse.json(
      { error: `Instrument non supporté: ${instrument}` },
      { status: 400 }
    );
  }

  // Compute exact month boundaries
  const [year, mon] = month.split("-").map(Number);
  const fromDate = new Date(Date.UTC(year, mon - 1, 1));
  const toDate = new Date(Date.UTC(year, mon, 1) - 1000); // last second of month, UTC

  let data: number[][];
  try {
    data = (await getHistoricalRates({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      instrument: dukascopyInstrument as any,
      dates: { from: fromDate, to: toDate },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      timeframe: timeframe as any,
      format: "array",
      batchSize: 10,
      pauseBetweenBatchesMs: 200,
    })) as number[][];
  } catch (err) {
    console.error("[ohlcv/download] dukascopy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch data from Dukascopy" },
      { status: 502 }
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Use createMany + skipDuplicates — single statement per chunk, no transaction timeout
  const CHUNK = 1000;
  let processed = 0;

  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    const result = await prisma.ohlcvBar.createMany({
      data: chunk.map((row: number[]) => ({
        instrument,
        timeframe,
        timestamp: BigInt(row[0]),
        open: row[1],
        high: row[2],
        low: row[3],
        close: row[4],
        volume: row[5] ?? 0,
      })),
      skipDuplicates: true,
    });
    processed += result.count;
  }

  return NextResponse.json({ processed });
}
