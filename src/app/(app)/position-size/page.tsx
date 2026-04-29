"use client";

import { useState, useMemo } from "react";
import { Calculator, AlertTriangle, TrendingUp, DollarSign, Target, Shield, Info } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────── */
type Category = "forex" | "indices" | "metals" | "crypto" | "dxy";
type Direction = "long" | "short";

interface InstrumentSpec {
  label: string;
  category: Category;
  pipSize: number;
  pipValuePerLot: number; // 0 = dynamic (JPY pairs)
  contractSize: number;
  decimalPlaces: number;
  isDynamicPipValue?: boolean;
}

interface Inputs {
  accountSize: string;
  riskPercent: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  instrument: string;
  direction: Direction;
  contractSize: string;
}

/* ─── Instrument specs ─────────────────────────────────────────────────── */
const INSTRUMENTS: Record<string, InstrumentSpec> = {
  EURUSD: { label: "EUR/USD", category: "forex",   pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, decimalPlaces: 5 },
  GBPUSD: { label: "GBP/USD", category: "forex",   pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, decimalPlaces: 5 },
  USDJPY: { label: "USD/JPY", category: "forex",   pipSize: 0.01,   pipValuePerLot: 0,    contractSize: 100000, decimalPlaces: 3, isDynamicPipValue: true },
  USDCHF: { label: "USD/CHF", category: "forex",   pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, decimalPlaces: 5 },
  AUDUSD: { label: "AUD/USD", category: "forex",   pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, decimalPlaces: 5 },
  USDCAD: { label: "USD/CAD", category: "forex",   pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, decimalPlaces: 5 },
  NZDUSD: { label: "NZD/USD", category: "forex",   pipSize: 0.0001, pipValuePerLot: 10,   contractSize: 100000, decimalPlaces: 5 },
  EURGBP: { label: "EUR/GBP", category: "forex",   pipSize: 0.0001, pipValuePerLot: 13,   contractSize: 100000, decimalPlaces: 5 },
  EURJPY: { label: "EUR/JPY", category: "forex",   pipSize: 0.01,   pipValuePerLot: 0,    contractSize: 100000, decimalPlaces: 3, isDynamicPipValue: true },
  GBPJPY: { label: "GBP/JPY", category: "forex",   pipSize: 0.01,   pipValuePerLot: 0,    contractSize: 100000, decimalPlaces: 3, isDynamicPipValue: true },
  EURCHF: { label: "EUR/CHF", category: "forex",   pipSize: 0.0001, pipValuePerLot: 11,   contractSize: 100000, decimalPlaces: 5 },
  AUDCAD: { label: "AUD/CAD", category: "forex",   pipSize: 0.0001, pipValuePerLot: 7.5,  contractSize: 100000, decimalPlaces: 5 },
  AUDNZD: { label: "AUD/NZD", category: "forex",   pipSize: 0.0001, pipValuePerLot: 6,    contractSize: 100000, decimalPlaces: 5 },
  CADJPY: { label: "CAD/JPY", category: "forex",   pipSize: 0.01,   pipValuePerLot: 0,    contractSize: 100000, decimalPlaces: 3, isDynamicPipValue: true },
  GER40:  { label: "GER40",   category: "indices", pipSize: 1,      pipValuePerLot: 25,   contractSize: 1,      decimalPlaces: 1 },
  US100:  { label: "US100",   category: "indices", pipSize: 1,      pipValuePerLot: 20,   contractSize: 1,      decimalPlaces: 1 },
  XAUUSD: { label: "XAU/USD", category: "metals",  pipSize: 0.1,    pipValuePerLot: 10,   contractSize: 100,    decimalPlaces: 2 },
  XAGUSD: { label: "XAG/USD", category: "metals",  pipSize: 0.01,   pipValuePerLot: 50,   contractSize: 5000,   decimalPlaces: 3 },
  BTCUSD: { label: "BTC/USD", category: "crypto",  pipSize: 1,      pipValuePerLot: 1,    contractSize: 1,      decimalPlaces: 1 },
  ETHUSD: { label: "ETH/USD", category: "crypto",  pipSize: 0.1,    pipValuePerLot: 1,    contractSize: 1,      decimalPlaces: 2 },
  DXY:    { label: "DXY",     category: "dxy",     pipSize: 0.001,  pipValuePerLot: 0.10, contractSize: 100,    decimalPlaces: 3 },
};

const CATEGORY_LABELS: Record<Category, string> = {
  forex:   "Forex",
  indices: "Indices",
  metals:  "Metals",
  crypto:  "Crypto",
  dxy:     "DXY",
};

const CATEGORY_ORDER: Category[] = ["forex", "indices", "metals", "crypto", "dxy"];

const DEFAULT_INSTRUMENT_PER_CATEGORY: Record<Category, string> = {
  forex:   "EURUSD",
  indices: "GER40",
  metals:  "XAUUSD",
  crypto:  "BTCUSD",
  dxy:     "DXY",
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

function getInstrumentsByCategory(category: Category): string[] {
  return Object.entries(INSTRUMENTS)
    .filter(([, spec]) => spec.category === category)
    .map(([key]) => key);
}

/* ─── Calculation logic ────────────────────────────────────────────────── */
interface CalcResult {
  dollarRisk: number;
  stopDist: number;
  stopDistPct: number;
  slPips: number;
  positionSize: number;
  units: number;
  positionLabel: string;
  pipValueUsed: number;
  rrRatio: number | null;
  potentialProfit: number | null;
  slValid: boolean;
  tpValid: boolean;
}

function calculate(inputs: Inputs): CalcResult | null {
  const account = parseNum(inputs.accountSize);
  const riskPct = parseNum(inputs.riskPercent);
  const entry = parseNum(inputs.entryPrice);
  const sl = parseNum(inputs.stopLoss);
  const tp = parseNum(inputs.takeProfit);

  if (account <= 0 || riskPct <= 0 || entry <= 0 || sl <= 0) return null;

  const spec = INSTRUMENTS[inputs.instrument];
  if (!spec) return null;

  const dollarRisk = (account * riskPct) / 100;
  const stopDist = Math.abs(entry - sl);
  if (stopDist === 0) return null;

  const stopDistPct = (stopDist / entry) * 100;
  const slPips = stopDist / spec.pipSize;

  // Resolve effective pip value per lot
  let pipValueUsed: number;
  if (spec.isDynamicPipValue) {
    // JPY pairs: pipValue = 1000 / entry (for 1 standard lot)
    pipValueUsed = entry > 0 ? 1000 / entry : 9; // fallback approx
  } else {
    pipValueUsed = spec.pipValuePerLot;
  }

  // CFD formula: Lots = dollarRisk / (SL pips × pipValuePerLot)
  const positionSize = dollarRisk / (slPips * pipValueUsed);

  // Units = lots × contract size (editable by user, defaults to spec.contractSize)
  const contractSizeUsed = parseNum(inputs.contractSize) || spec.contractSize;
  const units = positionSize * contractSizeUsed;

  let rrRatio: number | null = null;
  let potentialProfit: number | null = null;

  if (tp > 0) {
    const tpDist = Math.abs(tp - entry);
    rrRatio = tpDist / stopDist;
    potentialProfit = dollarRisk * rrRatio;
  }

  const isLong = inputs.direction === "long";
  const slValid = isLong ? sl < entry : sl > entry;
  const tpValid = tp === 0 || (isLong ? tp > entry : tp < entry);

  return {
    dollarRisk,
    stopDist,
    stopDistPct,
    slPips,
    positionSize,
    units,
    positionLabel: "lots",
    pipValueUsed,
    rrRatio,
    potentialProfit,
    slValid,
    tpValid,
  };
}

/* ─── Sub-components ───────────────────────────────────────────────────── */
function InputField({
  label, id, value, onChange, placeholder, prefix, suffix, hint,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; suffix?: string; hint?: string;
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
          <span className="absolute left-3 text-sm font-medium select-none" style={{ color: "var(--text-muted)" }}>
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
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,214,0,0.6)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        {suffix && (
          <span className="absolute right-3 text-sm font-medium select-none" style={{ color: "var(--text-muted)" }}>
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</p>
      )}
    </div>
  );
}

function ResultCard({
  label, value, sub, accent, icon,
}: {
  label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl p-4"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon && <span style={{ color: accent ?? "var(--text-muted)" }}>{icon}</span>}
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent ?? "var(--text-primary)" }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{sub}</p>
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function PositionSizePage() {
  const [selectedCategory, setSelectedCategory] = useState<Category>("forex");
  const [inputs, setInputs] = useState<Inputs>({
    accountSize: "10000",
    riskPercent: "1",
    entryPrice: "",
    stopLoss: "",
    takeProfit: "",
    instrument: "EURUSD",
    direction: "long",
    contractSize: "100000",
  });

  function set(key: keyof Inputs) {
    return (val: string) => setInputs((prev) => ({ ...prev, [key]: val }));
  }

  function selectCategory(cat: Category) {
    setSelectedCategory(cat);
    const defaultInstrument = DEFAULT_INSTRUMENT_PER_CATEGORY[cat];
    const newSpec = INSTRUMENTS[defaultInstrument];
    setInputs((prev) => ({ ...prev, instrument: defaultInstrument, entryPrice: "", stopLoss: "", takeProfit: "", contractSize: String(newSpec.contractSize) }));
  }

  function selectInstrument(key: string) {
    const newSpec = INSTRUMENTS[key];
    setInputs((prev) => ({ ...prev, instrument: key, entryPrice: "", stopLoss: "", takeProfit: "", contractSize: String(newSpec.contractSize) }));
  }

  const result = useMemo(() => calculate(inputs), [inputs]);
  const spec = INSTRUMENTS[inputs.instrument];
  const instrumentsInCategory = getInstrumentsByCategory(selectedCategory);

  const rrColor =
    result?.rrRatio == null
      ? "var(--text-muted)"
      : result.rrRatio >= 2
      ? "var(--accent-green-light)"
      : result.rrRatio >= 1
      ? "var(--accent-primary-light)"
      : "#ef4444";

  const entryPlaceholder = spec
    ? (spec.category === "dxy" ? "104.500" : spec.category === "indices" ? "18000" : spec.category === "crypto" ? "65000" : spec.category === "metals" ? "2300.00" : "1.08500")
    : "0.00000";

  return (
    <div className="mx-auto max-w-4xl">
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
          CFD position sizing — Forex, Indices, Metals, Crypto & DXY. Formula: Risk ÷ (SL pips × pip value/lot).
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

          {/* Direction + Instrument selection */}
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
                          ? d === "long" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"
                          : "transparent",
                      color:
                        inputs.direction === d
                          ? d === "long" ? "var(--accent-green-light)" : "#f87171"
                          : "var(--text-muted)",
                    }}
                  >
                    {d === "long" ? "▲ Long" : "▼ Short"}
                  </button>
                ))}
              </div>
            </div>

            {/* Category buttons */}
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Category
              </p>
              <div className="flex gap-2 flex-wrap">
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => selectCategory(cat)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150"
                    style={{
                      backgroundColor:
                        selectedCategory === cat ? "rgba(255,214,0,0.2)" : "var(--bg-input)",
                      color:
                        selectedCategory === cat ? "var(--accent-primary)" : "var(--text-secondary)",
                      border: `1px solid ${selectedCategory === cat ? "rgba(255,214,0,0.4)" : "var(--border)"}`,
                    }}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument grid */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Instrument
              </p>
              <div className="flex gap-2 flex-wrap">
                {instrumentsInCategory.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectInstrument(key)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150"
                    style={{
                      backgroundColor:
                        inputs.instrument === key ? "rgba(255,214,0,0.15)" : "var(--bg-input)",
                      color:
                        inputs.instrument === key ? "var(--accent-primary)" : "var(--text-secondary)",
                      border: `1px solid ${inputs.instrument === key ? "rgba(255,214,0,0.35)" : "var(--border)"}`,
                    }}
                  >
                    {INSTRUMENTS[key].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument info box */}
            {spec && (
              <div
                className="mt-4 rounded-lg px-3 py-2.5"
                style={{
                  backgroundColor: "rgba(255,214,0,0.06)",
                  border: "1px solid rgba(255,214,0,0.18)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Info size={11} style={{ color: "var(--accent-primary)" }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
                    {spec.label} specs
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Pip size: <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{spec.pipSize}</span>
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Pip value/lot:{" "}
                    <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {spec.isDynamicPipValue ? "dynamic (1000/entry)" : `$${spec.pipValuePerLot}`}
                    </span>
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Contract: <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>{spec.contractSize.toLocaleString()}</span>
                  </span>
                  {spec.category === "dxy" && (
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      FTMO MT5 · Tick 0.001 · $0.10/lot/pip
                    </span>
                  )}
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
            <div className="mb-4">
              <InputField
                label="Contract Size (units/lot)"
                id="contractSize"
                value={inputs.contractSize}
                onChange={set("contractSize")}
                placeholder={String(spec?.contractSize ?? 100000)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <InputField
                label="Entry Price"
                id="entry"
                value={inputs.entryPrice}
                onChange={set("entryPrice")}
                placeholder={entryPlaceholder}
              />
              <InputField
                label="Stop Loss"
                id="sl"
                value={inputs.stopLoss}
                onChange={set("stopLoss")}
                placeholder="0.00000"
                hint={
                  result && !result.slValid
                    ? "⚠ SL direction mismatch"
                    : result
                    ? `${fmt(result.slPips, 1)} pips · ${fmt(result.stopDistPct, 3)}%`
                    : undefined
                }
              />
              <InputField
                label="Take Profit"
                id="tp"
                value={inputs.takeProfit}
                onChange={set("takeProfit")}
                placeholder="Optional"
                hint={result?.tpValid === false ? "⚠ TP direction mismatch" : undefined}
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
                  {fmtCompact(result.positionSize)}
                </p>
                <p className="mt-1 text-sm font-medium" style={{ color: "rgba(255,214,0,0.7)" }}>
                  {result.positionLabel}
                </p>
                {/* Formula breakdown */}
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,214,0,0.15)" }}>
                  <p className="text-[10px]" style={{ color: "rgba(255,214,0,0.5)" }}>
                    {fmt(result.dollarRisk)} ÷ ({fmt(result.slPips, 1)} pips × ${fmt(result.pipValueUsed, result.pipValueUsed < 1 ? 3 : 2)})
                  </p>
                </div>
              </>
            ) : (
              <p className="text-3xl font-bold" style={{ color: "var(--text-muted)" }}>—</p>
            )}
          </div>

          {/* Units (deal size) */}
          <ResultCard
            label="Units (deal size)"
            value={result ? fmt(result.units, result.units >= 1 ? 3 : 6) : "—"}
            sub={result ? `${fmtCompact(result.positionSize)} lots × ${(parseNum(inputs.contractSize) || spec?.contractSize || 100000).toLocaleString()} units/lot` : undefined}
            accent="var(--accent-primary)"
            icon={<Calculator size={14} />}
          />

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
            value={result ? `${fmt(result.slPips, 1)} pips` : "—"}
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
                <p className="text-xs font-semibold" style={{ color: "#f87171" }}>Direction mismatch</p>
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
