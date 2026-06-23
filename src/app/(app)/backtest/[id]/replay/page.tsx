import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ReplayEngine } from "./ReplayEngine";
import type { Bar } from "./useReplayEngine";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; tf?: string }>;
};

export default async function ReplayPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from, to, tf = "m1" } = await searchParams;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const backtest = await prisma.backtest.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, instrument: true, periodStart: true, periodEnd: true, name: true },
  });
  if (!backtest) notFound();

  if (!from || !to) {
    // Cap defaultTo to last completed month (Dukascopy has no current/future month data)
    const prevMonthEnd = new Date();
    prevMonthEnd.setDate(0); // last day of previous month
    const cappedTo = [
      backtest.periodEnd.toISOString().slice(0, 10),
      prevMonthEnd.toISOString().slice(0, 10),
    ].sort()[0]; // min of the two

    return (
      <PeriodSelector
        backtestId={id}
        instrument={backtest.instrument}
        defaultFrom={backtest.periodStart.toISOString().slice(0, 10)}
        defaultTo={cappedTo}
      />
    );
  }

  const fromMs = new Date(from).getTime();
  const toMs   = new Date(to).getTime();
  if (isNaN(fromMs) || isNaN(toMs)) {
    redirect(`/backtest/${id}/replay`);
  }

  // Always read M1 from DB — aggregate to requested TF in memory
  const TF_MINUTES: Record<string, number> = {
    m1: 1, m5: 5, m15: 15, m30: 30, h1: 60, h4: 240, d1: 1440,
  };

  // Extend toMs to end of day to include all bars on the to-date
  const toMsEndOfDay = toMs + 24 * 60 * 60 * 1000 - 1;

  const m1Bars = await prisma.ohlcvBar.findMany({
    where: {
      instrument: backtest.instrument,
      timeframe: "m1",
      timestamp: { gte: BigInt(fromMs), lte: BigInt(toMsEndOfDay) },
    },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, open: true, high: true, low: true, close: true, volume: true },
  });

  console.log(`[replay] ${backtest.instrument} m1 bars found: ${m1Bars.length}, fromMs=${fromMs}, toMs=${toMsEndOfDay}`);

  if (m1Bars.length === 0) {
    return (
      <NoDataScreen
        backtestId={id}
        instrument={backtest.instrument}
        from={from}
        to={to}
        timeframe={tf}
      />
    );
  }

  const tfMinutes = TF_MINUTES[tf] ?? 1;
  const periodMs = tfMinutes * 60 * 1000;

  // Aggregate M1 → requested timeframe
  const buckets = new Map<number, { open: number; high: number; low: number; close: number; volume: number }>();
  for (const b of m1Bars) {
    const barMs = Number(b.timestamp);
    const bucketMs = Math.floor(barMs / periodMs) * periodMs;
    const ex = buckets.get(bucketMs);
    if (!ex) {
      buckets.set(bucketMs, { open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
    } else {
      ex.high = Math.max(ex.high, b.high);
      ex.low  = Math.min(ex.low,  b.low);
      ex.close = b.close;
      ex.volume += b.volume;
    }
  }

  const bars: Bar[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucketMs, b]) => ({ time: bucketMs / 1000, ...b }));

  return <ReplayEngine backtestId={id} instrument={backtest.instrument} initialBars={bars} tf={tf} />;
}

function PeriodSelector({ backtestId, instrument, defaultFrom, defaultTo }: {
  backtestId: string; instrument: string; defaultFrom: string; defaultTo: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#0f1117" }}>
      <div className="w-full max-w-md rounded-2xl p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <Link href={`/backtest/${backtestId}`} className="mb-6 flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={14} /> Back to backtest
        </Link>
        <h1 className="mb-1 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Replay Mode</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>{instrument}</p>

        <form method="GET" className="flex flex-col gap-4">
          {[
            { name: "from", label: "From", defaultValue: defaultFrom },
            { name: "to",   label: "To",   defaultValue: defaultTo   },
          ].map(({ name, label, defaultValue }) => (
            <div key={name}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</label>
              <input type="date" name={name} defaultValue={defaultValue} className="w-full rounded-xl px-3 py-2 text-sm"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Timeframe</label>
            <select name="tf" defaultValue="m1" className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="m1">M1</option>
              <option value="m5">M5</option>
              <option value="m15">M15</option>
              <option value="h1">H1</option>
            </select>
          </div>
          <button type="submit" className="mt-2 w-full rounded-xl py-3 text-sm font-bold"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}>
            Load Replay
          </button>
        </form>
      </div>
    </div>
  );
}

function NoDataScreen({ backtestId, instrument, from, to, timeframe }: {
  backtestId: string; instrument: string; from: string; to: string; timeframe: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4" style={{ backgroundColor: "#0f1117" }}>
      <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>No OHLCV data found</p>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{instrument} · {timeframe.toUpperCase()} · {from} → {to}</p>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Download data first from the backtest page.</p>
      <Link href={`/backtest/${backtestId}`} className="mt-2 rounded-xl px-6 py-2.5 text-sm font-bold"
        style={{ backgroundColor: "#6366f1", color: "#fff" }}>
        Back to Backtest
      </Link>
    </div>
  );
}
