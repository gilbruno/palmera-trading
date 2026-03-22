"use client";

import { useState, useMemo } from "react";
import { Calculator, AlertTriangle, TrendingUp, DollarSign, Target, Shield } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────── */
type InstrumentType = "forex" | "indices" | "stocks" | "crypto";
type ForexLotType = "standard" | "mini" | "micro";
type Direction = "long" | "short";

interface Inputs {
  accountSize: string;
  riskPercent: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  instrumentType: InstrumentType;
  forexLotType: ForexLotType;
  direction: Direction;
}

/* ─── Constants ────────────────────────────────────────────────────────── */
const LOT_SIZES: Record<ForexLotType, number> = {
  standard: 100_000,
  mini: 10_000,
  micro: 1_000,
};

const LOT_LABELS: Record<ForexLotType, string> = {
  standard: "Standard lots (100k)",
  mini: "Mini lots (10k)",
  micro: "Micro lots (1k)",
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function parseNum(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function fmt(n: number, decimals = 2): string {
  if (!isFinite(n) || isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCompact(n: number): string {
  if (!isFinite(n) || isNaN(n) || n === 0) return "—";
  if (n >= 1) return fmt(n, 2);
  if (n >= 0.01) return fmt(n, 4);
  return fmt(n, 6);
}

/* ─── Calculation logic ────────────────────────────────────────────────── */
function calculate(inputs: Inputs) {
  const account = parseNum(inputs.accountSize);
  const riskPct = parseNum(inputs.riskPercent);
  const entry = parseNum(inputs.entryPrice);
  const sl = parseNum(inputs.stopLoss);
  const tp = parseNum(inputs.takeProfit);

  if (account <= 0 || riskPct <= 0 || entry <= 0 || sl <= 0) return null;

  const dollarRisk = (account * riskPct) / 100;
  const stopDist = Math.abs(entry - sl);
  if (stopDist === 0) return null;

  const stopDistPct = (stopDist / entry) * 100;

  // Position size in base units
  const unitsRaw = dollarRisk / stopDist;

  let positionSize: number;
  let positionLabel: string;
  let positionSizeRaw = unitsRaw;

  if (inputs.instrumentType === "forex") {
    const lotSize = LOT_SIZES[inputs.forexLotType];
    positionSize = unitsRaw / lotSize;
    positionLabel = inputs.forexLotType === "standard"
      ? "lots"
      : inputs.forexLotType === "mini"
      ? "mini lots"
      : "micro lots";
    positionSizeRaw = positionSize;
  } else if (inputs.instrumentType === "stocks") {
    positionSize = Math.floor(unitsRaw);
    positionLabel = "shares";
    positionSizeRaw = positionSize;
  } else if (inputs.instrumentType === "crypto") {
    positionSize = unitsRaw;
    positionLabel = "coins";
    positionSizeRaw = positionSize;
  } else {
    // indices / CFD
    positionSize = unitsRaw;
    positionLabel = "contracts";
    positionSizeRaw = positionSize;
  }

  // R:R and potential profit
  let rrRatio: number | null = null;
  let potentialProfit: number | null = null;

  if (tp > 0 && entry > 0) {
    const tpDist = Math.abs(tp - entry);
    rrRatio = tpDist / stopDist;
    potentialProfit = dollarRisk * rrRatio;
  }

  // Validate direction consistency
  const isLong = inputs.direction === "long";
  const slValid = isLong ? sl < entry : sl > entry;
  const tpValid = tp === 0 || (isLong ? tp > entry : tp < entry);

  return {
    dollarRisk,
    stopDist,
    stopDistPct,
    positionSize: positionSizeRaw,
    positionLabel,
    rrRatio,
    potentialProfit,
    slValid,
    tpValid,
  };
}

/* ─── Sub-components ───────────────────────────────────────────────────── */
function InputField({
  label,
  id,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix && (
          <span
            className="absolute left-3 text-sm font-medium select-none"
            style={{ color: "var(--text-muted)" }}
          >
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="block w-full rounded-xl py-2.5 text-sm transition-colors placeholder:opacity-40"
          style={{
            backgroundColor: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            outline: "none",
            paddingLeft: prefix ? "1.75rem" : "0.75rem",
            paddingRight: suffix ? "2.5rem" : "0.75rem",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "rgba(255,214,0,0.6)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "var(--border)")
          }
        />
        {suffix && (
          <span
            className="absolute right-3 text-sm font-medium select-none"
            style={{ color: "var(--text-muted)" }}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function ResultCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl p-4"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && (
          <span style={{ color: accent ?? "var(--text-muted)" }}>{icon}</span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent ?? "var(--text-primary)" }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function PositionSizePage() {
  const [inputs, setInputs] = useState<Inputs>({
    accountSize: "10000",
    riskPercent: "1",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    instrumentType: "forex",
    forexLotType: "standard",
    direction: "long",
  });

  function set(key: keyof Inputs) {
    return (val: string) => setInputs((prev) => ({ ...prev, [key]: val }));
  }

  const result = useMemo(() => calculate(inputs), [inputs]);

  const rrColor =
    result?.rrRatio == null
      ? "var(--text-muted)"
      : result.rrRatio >= 2
      ? "var(--accent-green-light)"
      : result.rrRatio >= 1
      ? "var(--accent-primary-light)"
      : "#ef4444";

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(255,214,0,0.2)" }}
          >
            <Calculator size={18} style={{ color: "var(--accent-primary)" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Position Size Calculator
          </h1>
        </div>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Calculate your exact position size based on account risk, entry and stop loss.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* ── Left: Inputs ── */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* Account & Risk */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Account
            </p>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Account Size"
                id="account"
                value={inputs.accountSize}
                onChange={set("accountSize")}
                placeholder="10000"
                prefix="$"
              />
              <InputField
                label="Risk per Trade"
                id="risk"
                value={inputs.riskPercent}
                onChange={set("riskPercent")}
                placeholder="1"
                suffix="%"
                hint={
                  inputs.accountSize && inputs.riskPercent
                    ? `= $${fmt(parseNum(inputs.accountSize) * parseNum(inputs.riskPercent) / 100)} at risk`
                    : undefined
                }
              />
            </div>
          </div>

          {/* Direction + Instrument */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Instrument
            </p>

            {/* Direction toggle */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Direction
              </p>
              <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {(["long", "short"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setInputs((p) => ({ ...p, direction: d }))}
                    className="flex-1 py-2 text-sm font-semibold capitalize transition-colors duration-150"
                    style={{
                      backgroundColor:
                        inputs.direction === d
                          ? d === "long"
                            ? "rgba(16,185,129,0.2)"
                            : "rgba(239,68,68,0.2)"
                          : "transparent",
                      color:
                        inputs.direction === d
                          ? d === "long"
                            ? "var(--accent-green-light)"
                            : "#f87171"
                          : "var(--text-muted)",
                    }}
                  >
                    {d === "long" ? "▲ Long" : "▼ Short"}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument type */}
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Type
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(["forex", "indices", "stocks", "crypto"] as InstrumentType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setInputs((p) => ({ ...p, instrumentType: t }))}
                    className="rounded-lg py-1.5 text-xs font-semibold capitalize transition-colors duration-150"
                    style={{
                      backgroundColor:
                        inputs.instrumentType === t
                          ? "rgba(255,214,0,0.2)"
                          : "var(--bg-input)",
                      color:
                        inputs.instrumentType === t
                          ? "var(--accent-primary)"
                          : "var(--text-secondary)",
                      border: `1px solid ${inputs.instrumentType === t ? "rgba(255,214,0,0.4)" : "var(--border)"}`,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Forex lot type */}
            {inputs.instrumentType === "forex" && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Lot type
                </p>
                <div className="flex flex-col gap-1.5">
                  {(["standard", "mini", "micro"] as ForexLotType[]).map((lt) => (
                    <button
                      key={lt}
                      type="button"
                      onClick={() => setInputs((p) => ({ ...p, forexLotType: lt }))}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors duration-150"
                      style={{
                        backgroundColor:
                          inputs.forexLotType === lt
                            ? "rgba(255,214,0,0.15)"
                            : "var(--bg-input)",
                        color:
                          inputs.forexLotType === lt
                            ? "var(--accent-primary)"
                            : "var(--text-secondary)",
                        border: `1px solid ${inputs.forexLotType === lt ? "rgba(255,214,0,0.35)" : "var(--border)"}`,
                      }}
                    >
                      <span className="font-semibold capitalize">{lt}</span>
                      <span style={{ color: "var(--text-muted)" }}>{LOT_LABELS[lt]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prices */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Prices
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <InputField
                label="Entry Price"
                id="entry"
                value={inputs.entryPrice}
                onChange={set("entryPrice")}
                placeholder="1.08500"
              />
              <InputField
                label="Stop Loss"
                id="sl"
                value={inputs.stopLoss}
                onChange={set("stopLoss")}
                placeholder="1.08000"
                hint={
                  result && !result.slValid
                    ? "⚠ SL direction mismatch"
                    : result
                    ? `${fmt(result.stopDist, 5)} pts · ${fmt(result.stopDistPct, 3)}%`
                    : undefined
                }
              />
              <InputField
                label="Take Profit"
                id="tp"
                value={inputs.takeProfit}
                onChange={set("takeProfit")}
                placeholder="Optional"
                hint={
                  result?.tpValid === false
                    ? "⚠ TP direction mismatch"
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Position size — hero card */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "linear-gradient(135deg, rgba(255,214,0,0.15) 0%, rgba(255,214,0,0.05) 100%)",
              border: "1px solid rgba(255,214,0,0.3)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Calculator size={14} style={{ color: "var(--accent-primary)" }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
                Position Size
              </span>
            </div>
            {result ? (
              <>
                <p className="text-4xl font-bold tabular-nums" style={{ color: "var(--accent-primary)" }}>
                  {inputs.instrumentType === "forex"
                    ? fmtCompact(result.positionSize)
                    : inputs.instrumentType === "stocks"
                    ? fmt(result.positionSize, 0)
                    : fmtCompact(result.positionSize)}
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: "rgba(255,214,0,0.7)" }}>
                  {result.positionLabel}
                </p>
              </>
            ) : (
              <p className="text-3xl font-bold" style={{ color: "var(--text-muted)" }}>
                —
              </p>
            )}
          </div>

          {/* Dollar at risk */}
          <ResultCard
            label="Dollar at Risk"
            value={result ? `$${fmt(result.dollarRisk)}` : "—"}
            sub={result ? `${inputs.riskPercent}% of $${fmt(parseNum(inputs.accountSize), 0)}` : undefined}
            accent="var(--accent-primary)"
            icon={<DollarSign size={14} />}
          />

          {/* Stop distance */}
          <ResultCard
            label="Stop Distance"
            value={result ? fmtCompact(result.stopDist) : "—"}
            sub={result ? `${fmt(result.stopDistPct, 3)}% from entry` : undefined}
            accent="var(--accent-secondary)"
            icon={<Shield size={14} />}
          />

          {/* R:R ratio */}
          <ResultCard
            label="Risk / Reward"
            value={result?.rrRatio != null ? `1 : ${fmt(result.rrRatio, 2)}` : "—"}
            sub={
              result?.rrRatio != null
                ? result.rrRatio >= 2
                  ? "Excellent setup"
                  : result.rrRatio >= 1.5
                  ? "Good setup"
                  : result.rrRatio >= 1
                  ? "Acceptable"
                  : "Poor R:R — avoid"
                : "Add TP to calculate"
            }
            accent={rrColor}
            icon={<Target size={14} />}
          />

          {/* Potential profit */}
          {result?.potentialProfit != null && (
            <ResultCard
              label="Potential Profit"
              value={`$${fmt(result.potentialProfit)}`}
              sub={`If TP hit at ${inputs.takeProfit}`}
              accent="var(--accent-green-light)"
              icon={<TrendingUp size={14} />}
            />
          )}

          {/* Warnings */}
          {result && (!result.slValid || !result.tpValid) && (
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{
                backgroundColor: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: "#f87171" }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: "#f87171" }}>
                  Direction mismatch
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {!result.slValid && "Stop loss must be below entry for Long (above for Short). "}
                  {!result.tpValid && "Take profit must be above entry for Long (below for Short)."}
                </p>
              </div>
            </div>
          )}

          {/* No result hint */}
          {!result && (
            <div
              className="rounded-xl p-4 text-center"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Fill in account, risk, entry and stop loss to compute position size.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
