"use client";

import { useState, useMemo } from "react";
import { BarChart2, TrendingUp, TrendingDown } from "lucide-react";
import type { Direction, TradeOutcome } from "@/generated/prisma/enums";
import { TradeRow } from "./TradeRow";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface TradeMedia {
  id: string;
  url: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

export interface RawTrade {
  id: string;
  tradeNumber: number;
  direction: Direction;
  outcome: TradeOutcome | null;
  entryDate: Date;
  exitDate: Date | null;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  rMultiple: number | null;
  pnlDollars: number | null;
  pnlPoints: number | null;
  quantity: number;
  grade: number | null;
  notes: string | null;
  tags: string[];
  screenshotUrl: string | null;
  media?: TradeMedia[];
  marketSession: string | null;
  timeframeEntry: string | null;
  timeframeTrend: string | null;
  ictModel: string | null;
  poi: string | null;
  biasHTF: string | null;
  biasMTF: string | null;
  marketStructure: string | null;
  liquiditySwept: string | null;
  isFomo: boolean;
  isRevenge: boolean;
  isImpulsive: boolean;
  followedRules: boolean | null;
  // Scénarios alternatifs
  outcome1R:    TradeOutcome | null;
  rMultiple1R:  number | null;
  outcome15R:   TradeOutcome | null;
  rMultiple15R: number | null;
}

type Scenario = "2R" | "1.5R" | "1R";

const SCENARIOS: Scenario[] = ["2R", "1.5R", "1R"];

function applyScenario(
  trade: RawTrade,
  scenario: Scenario
): { outcome: TradeOutcome | null; rMultiple: number | null } {
  if (scenario === "1R")   return { outcome: trade.outcome1R,  rMultiple: trade.rMultiple1R };
  if (scenario === "1.5R") return { outcome: trade.outcome15R, rMultiple: trade.rMultiple15R };
  return { outcome: trade.outcome, rMultiple: trade.rMultiple };
}

/* ─── Stat helpers ──────────────────────────────────────────────────────── */
function computeStats(trades: {
  outcome: TradeOutcome | null;
  rMultiple: number | null;
  pnlDollars: number | null;
}[]) {
  const closed = trades.filter((t) => t.outcome !== null);
  const total = closed.length;
  if (total === 0) return null;

  const wins = closed.filter((t) => t.outcome === "WIN");
  const losses = closed.filter((t) => t.outcome === "LOSS");
  const winrate = (wins.length / total) * 100;

  const withR = closed.filter((t) => t.rMultiple !== null);
  const sumWinR = wins.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!, 0);
  const sumLossR = Math.abs(losses.filter((t) => t.rMultiple !== null).reduce((s, t) => s + t.rMultiple!, 0));
  const totalR = withR.reduce((s, t) => s + t.rMultiple!, 0);
  const avgWinR = wins.filter((t) => t.rMultiple !== null).length > 0
    ? sumWinR / wins.filter((t) => t.rMultiple !== null).length : null;
  const avgLossR = losses.filter((t) => t.rMultiple !== null).length > 0
    ? sumLossR / losses.filter((t) => t.rMultiple !== null).length : null;
  const profitFactor = sumLossR > 0 ? sumWinR / sumLossR : sumWinR > 0 ? Infinity : null;
  const expectancy = withR.length > 0 ? totalR / withR.length : null;

  let peak = 0, maxDD = 0, cumR = 0;
  for (const t of withR) {
    cumR += t.rMultiple!;
    if (cumR > peak) peak = cumR;
    const dd = peak - cumR;
    if (dd > maxDD) maxDD = dd;
  }

  const totalPnl = closed.filter((t) => t.pnlDollars !== null).reduce((s, t) => s + t.pnlDollars!, 0);

  return {
    total,
    wins: wins.length,
    losses: losses.length,
    breakeven: closed.filter((t) => t.outcome === "BREAKEVEN").length,
    winrate,
    profitFactor,
    expectancy,
    totalR,
    avgWinR,
    avgLossR,
    maxDD,
    totalPnl,
    bestR: withR.length > 0 ? Math.max(...withR.map((t) => t.rMultiple!)) : null,
    worstR: withR.length > 0 ? Math.min(...withR.map((t) => t.rMultiple!)) : null,
  };
}

function fmtR(v: number | null | undefined): string {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "R";
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(1) + "%";
}
function fmtPF(v: number | null | undefined): string {
  if (v == null) return "—";
  if (!isFinite(v)) return "∞";
  return v.toFixed(2);
}

/* ─── Compact KPI cell ──────────────────────────────────────────────────── */
function KpiCell({
  label, value, positive, neutral,
}: {
  label: string; value: string; positive?: boolean; neutral?: boolean;
}) {
  const color = neutral
    ? "var(--text-secondary)"
    : value === "—"
    ? "var(--text-muted)"
    : positive
    ? "var(--accent-tertiary-light)"
    : "#f87171";
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl px-3 py-2.5 text-center"
      style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
    >
      <p
        className="mb-1 text-xs font-semibold uppercase tracking-widest"
        style={{
          color: "var(--text-muted)",
          fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

/* ─── Equity curve mini ─────────────────────────────────────────────────── */
function EquityCurveMini({
  trades,
}: {
  trades: { rMultiple: number | null; outcome: TradeOutcome | null }[];
}) {
  const withR = trades.filter((t) => t.rMultiple !== null && t.outcome !== null);
  if (withR.length === 0) return null;

  let cum = 0;
  const points = withR.map((t) => {
    cum += t.rMultiple!;
    return { r: t.rMultiple!, cum };
  });

  const total = points.length;
  const maxAbs = Math.max(...points.map((p) => Math.abs(p.cum)), 0.01);

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl px-5 py-3"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p
          className="text-base font-semibold uppercase tracking-widest"
          style={{
            color: "var(--text-muted)",
            fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          }}
        >
          Equity curve · {total} trades · {fmtR(cum)} cumulative
        </p>
        <p className="text-sm tabular-nums" style={{ color: cum >= 0 ? "var(--accent-tertiary-light)" : "#f87171" }}>
          {cum >= 0 ? "+" : ""}{cum.toFixed(2)}R
        </p>
      </div>

      <div className="flex h-2 w-full gap-px overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
        {points.map((p, i) => {
          const widthPct = 100 / total;
          const color = p.r > 0 ? "var(--accent-tertiary)" : p.r < 0 ? "#ef4444" : "var(--text-muted)";
          const opacity = 0.5 + 0.5 * (Math.abs(p.r) / (maxAbs / total || 1));
          return (
            <div
              key={i}
              style={{
                width: `${widthPct}%`,
                backgroundColor: color,
                opacity: Math.min(opacity, 1),
                flexShrink: 0,
              }}
              title={`Trade ${i + 1}: ${p.r >= 0 ? "+" : ""}${p.r.toFixed(2)}R (cum: ${fmtR(p.cum)})`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Scenario selector ─────────────────────────────────────────────────── */
function ScenarioSelector({
  value,
  onChange,
}: {
  value: Scenario;
  onChange: (s: Scenario) => void;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <p
        className="text-xs font-semibold uppercase tracking-widest shrink-0"
        style={{
          color: "var(--text-muted)",
          fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          letterSpacing: "0.12em",
        }}
      >
        Scénario
      </p>
      <div className="flex gap-2">
        {SCENARIOS.map((s) => {
          const active = value === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="rounded-xl px-3 py-1.5 text-base font-semibold transition-all"
              style={
                active
                  ? {
                      backgroundColor: "rgba(99,102,241,0.18)",
                      border: "1px solid rgba(99,102,241,0.5)",
                      color: "#a5b4fc",
                    }
                  : {
                      backgroundColor: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                      color: "var(--text-muted)",
                    }
              }
            >
              {s === "2R" ? "Normal" : s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────────── */
export function BacktestScenarioView({
  trades,
  backtestId,
  instrument,
}: {
  trades: RawTrade[];
  backtestId: string;
  instrument: string;
}) {
  const [scenario, setScenario] = useState<Scenario>("2R");

  const adjustedTrades = useMemo(
    () => trades.map((t) => ({ ...t, ...applyScenario(t, scenario) })),
    [trades, scenario]
  );

  const stats = computeStats(adjustedTrades);

  return (
    <>
      {/* ── Scenario selector + KPI bar ── */}
      <div
        className="mb-6 rounded-2xl px-5 py-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <ScenarioSelector value={scenario} onChange={setScenario} />

        {stats ? (
          <div className="grid grid-cols-8 gap-2">
            <KpiCell label="Trades"       value={String(stats.total)}                                                          neutral />
            <KpiCell label="Winrate"      value={fmtPct(stats.winrate)}                                                        positive={stats.winrate >= 50} />
            <KpiCell label="Prof. Factor" value={fmtPF(stats.profitFactor)}                                                    positive={stats.profitFactor !== null && (isFinite(stats.profitFactor) ? stats.profitFactor >= 1 : true)} />
            <KpiCell label="Expectancy"   value={fmtR(stats.expectancy)}                                                       positive={(stats.expectancy ?? 0) > 0} />
            <KpiCell label="Total R"      value={fmtR(stats.totalR)}                                                           positive={(stats.totalR ?? 0) > 0} />
            <KpiCell label="Avg Win"      value={fmtR(stats.avgWinR)}                                                          positive />
            <KpiCell label="Avg Loss"     value={stats.avgLossR != null ? "-" + stats.avgLossR.toFixed(2) + "R" : "—"}        positive={false} />
            <KpiCell label="Max DD"       value={stats.maxDD > 0 ? "-" + stats.maxDD.toFixed(2) + "R" : "0R"}                 positive={stats.maxDD === 0} />
          </div>
        ) : (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <BarChart2 size={16} />
            <p className="text-lg">No completed trades yet — add trades to see statistics.</p>
          </div>
        )}
      </div>

      {/* ── Equity curve mini bar ── */}
      <EquityCurveMini trades={adjustedTrades} />

      {/* ── Trade table ── */}
      <div
        className="mb-6 overflow-hidden rounded-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Table header row */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Trades ({trades.length})
            </p>
            {trades.length > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1">
                  <TrendingUp size={11} style={{ color: "var(--accent-tertiary-light)" }} />
                  {trades.filter((t) => t.outcome === "WIN").length}W
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown size={11} style={{ color: "#f87171" }} />
                  {trades.filter((t) => t.outcome === "LOSS").length}L
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Column headers */}
        {trades.length > 0 && (
          <div
            className="flex items-center gap-3 border-b px-5 py-2"
            style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.01)" }}
          >
            <span className="w-5 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>#</span>
            <span className="w-14 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Dir.</span>
            <span className="w-20 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Date</span>
            <span className="w-28 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Entry → Exit</span>
            <span className="w-12 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Result</span>
            <span className="w-14 shrink-0 text-right text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>R</span>
            <span className="w-16 shrink-0 text-right text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>P&L $</span>
            <span className="w-16 shrink-0 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Grade</span>
            <span className="flex-1 text-base font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Notes</span>
            <span className="ml-auto w-16 shrink-0" />
          </div>
        )}

        {trades.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>
              No trades yet. Use the form below to add your first trade.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {adjustedTrades.map((trade, i) => {
              const original = trades[i];
              const missingData = scenario !== "2R" && (
                scenario === "1R" ? original.outcome1R === null : original.outcome15R === null
              );
              return (
                <div
                  key={trade.id}
                  style={missingData ? { opacity: 0.45 } : undefined}
                  title={missingData ? "Données non saisies pour ce scénario" : undefined}
                >
                  <TradeRow
                    trade={trade}
                    backtestId={backtestId}
                    instrument={instrument}
                    rMultipleOverride={scenario !== "2R" ? trade.rMultiple : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
