"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Download, Play, Check, AlertCircle, Loader2 } from "lucide-react";

type Props = {
  backtestId: string;
  instrument: string;
  periodStart: string;
  periodEnd: string;
};

type CoverageState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "needs-download"; missingMonths: string[] }
  | { status: "downloading"; missingMonths: string[]; doneCount: number }
  | { status: "done" }
  | { status: "error"; message: string };

export function OhlcvDataManager({ backtestId, instrument, periodStart, periodEnd }: Props) {
  const [state, setState] = useState<CoverageState>({ status: "loading" });

  const checkCoverage = useCallback(async () => {
    setState({ status: "loading" });
    // Cap the end date to last completed month (Dukascopy has no future/current-month data)
    // e.g. in June 2026 → last available = May 2026 → cappedEndDate = "2026-05-31"
    const today = new Date();
    // First day of current month, minus 1ms = last moment of previous month
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const y = prevMonthEnd.getFullYear();
    const m = String(prevMonthEnd.getMonth() + 1).padStart(2, "0");
    const d = String(prevMonthEnd.getDate()).padStart(2, "0");
    const lastAvailableMonth = `${y}-${m}`; // "YYYY-MM" for filtering
    const cappedEndDate = `${y}-${m}-${d}`;  // "YYYY-MM-DD" for coverage API
    const cappedEnd = periodEnd < cappedEndDate ? periodEnd : cappedEndDate;

    try {
      const res = await fetch(
        `/api/ohlcv/coverage?instrument=${instrument}&timeframe=m1&from=${periodStart}&to=${cappedEnd}`
      );
      if (!res.ok) throw new Error("Coverage check failed");
      const { missingMonths: raw } = (await res.json()) as {
        coveredMonths: string[];
        missingMonths: string[];
      };
      // Extra safety: drop any month >= current month
      const missingMonths = raw.filter((m) => m < lastAvailableMonth);

      if (missingMonths.length === 0) {
        setState({ status: "ready" });
      } else {
        setState({ status: "needs-download", missingMonths });
      }
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }, [instrument, periodStart, periodEnd]);

  useEffect(() => {
    checkCoverage();
  }, [checkCoverage]);

  async function handleDownload() {
    if (state.status !== "needs-download") return;
    const { missingMonths } = state;

    setState({ status: "downloading", missingMonths, doneCount: 0 });

    for (let i = 0; i < missingMonths.length; i++) {
      const month = missingMonths[i];
      try {
        const res = await fetch("/api/ohlcv/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrument, month, timeframe: "m1" }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          setState({ status: "error", message: err.error ?? `Failed on ${month}` });
          return;
        }
        const data = (await res.json()) as { processed: number };
        void data; // processed count available if needed
      } catch {
        setState({ status: "error", message: `Network error on ${month}` });
        return;
      }
      setState({ status: "downloading", missingMonths, doneCount: i + 1 });
    }

    setState({ status: "done" });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={13} className="animate-spin" />
        Checking data…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm" style={{ color: "#ef4444" }}>
          <AlertCircle size={13} /> {state.message}
        </span>
        <button
          onClick={checkCoverage}
          className="rounded-lg px-2 py-1 text-xs"
          style={{
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.status === "ready" || state.status === "done") {
    return (
      <Link
        href={`/backtest/${backtestId}/replay`}
        className="flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-bold"
        style={{ backgroundColor: "#6366f1", color: "#fff" }}
      >
        <Play size={13} /> Replay Mode
      </Link>
    );
  }

  if (state.status === "needs-download") {
    const { missingMonths } = state;
    return (
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold"
        style={{
          backgroundColor: "var(--bg-surface)",
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
        }}
      >
        <Download size={13} />
        Download {missingMonths.length} month{missingMonths.length > 1 ? "s" : ""} to enable Replay
      </button>
    );
  }

  // status === "downloading"
  if (state.status === "downloading") {
    const { missingMonths, doneCount } = state;
    const total = missingMonths.length;
    const pct = Math.round((doneCount / total) * 100);
    const currentMonth = missingMonths[doneCount] ?? missingMonths[total - 1];

    return (
      <div className="flex flex-col gap-1.5 min-w-[220px]">
        <div
          className="flex items-center justify-between text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <span className="flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" />
            {currentMonth}…
          </span>
          <span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>
            {doneCount}/{total} ({pct}%)
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: "#6366f1" }}
          />
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {missingMonths.slice(0, doneCount).map((m) => (
            <span key={m} className="flex items-center gap-0.5" style={{ color: "#22c55e" }}>
              <Check size={10} /> {m}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
