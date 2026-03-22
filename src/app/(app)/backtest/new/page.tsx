import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { FlaskConical, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createBacktest } from "../actions";

/* ─── Form ──────────────────────────────────────────────────────────────── */
function inputStyle(): React.CSSProperties {
  return {
    backgroundColor: "var(--bg-input, rgba(255,255,255,0.04))",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    color: "var(--text-primary)",
    outline: "none",
  };
}

const TIMEFRAMES = [
  { value: "", label: "— Select —" },
  { value: "M1", label: "1m" },
  { value: "M5", label: "5m" },
  { value: "M15", label: "15m" },
  { value: "M30", label: "30m" },
  { value: "H1", label: "1H" },
  { value: "H4", label: "4H" },
  { value: "D1", label: "Daily" },
  { value: "W1", label: "Weekly" },
];

const INSTRUMENTS = ["NQ", "ES", "YM", "RTY", "CL", "GC", "SI", "EUR/USD", "GBP/USD", "USD/JPY", "BTC/USD", "ETH/USD", "SPX", "NDX"];

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default async function NewBacktestPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const setups = await prisma.setup.findMany({
    where: { userId: session.user.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const today = new Date().toISOString().split("T")[0];
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-widest";
  const labelStyle: React.CSSProperties = { color: "var(--text-muted)" };
  const inputClass = "block w-full px-3.5 py-2.5 text-base transition-all focus:ring-2 focus:ring-[var(--accent-primary)] placeholder:opacity-40";

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/backtest"
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-white/5"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(99,102,241,0.18)" }}
          >
            <FlaskConical size={18} style={{ color: "#a5b4fc" }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              New Backtest
            </h1>
            <p className="text-base" style={{ color: "var(--text-secondary)" }}>
              Define parameters and start adding trades
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form action={createBacktest}>
        <div
          className="overflow-hidden rounded-2xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {/* Section: Identity */}
          <div className="border-b px-6 py-4" style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.01)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Identity
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            {/* Name */}
            <div>
              <label htmlFor="name" className={labelClass} style={labelStyle}>
                Backtest Name <span style={{ color: "#f87171" }}>*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. NQ Silver Bullet — Q1 2025"
                className={inputClass}
                style={inputStyle()}
              />
            </div>

            {/* Instrument + Timeframe */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="instrument" className={labelClass} style={labelStyle}>
                  Instrument <span style={{ color: "#f87171" }}>*</span>
                </label>
                <input
                  id="instrument"
                  name="instrument"
                  type="text"
                  required
                  list="instrument-suggestions"
                  placeholder="NQ, ES, EUR/USD…"
                  className={inputClass}
                  style={inputStyle()}
                />
                <datalist id="instrument-suggestions">
                  {INSTRUMENTS.map((i) => <option key={i} value={i} />)}
                </datalist>
              </div>
              <div>
                <label htmlFor="timeframe" className={labelClass} style={labelStyle}>
                  Timeframe
                </label>
                <select
                  id="timeframe"
                  name="timeframe"
                  className={inputClass}
                  style={inputStyle()}
                >
                  {TIMEFRAMES.map((tf) => (
                    <option key={tf.value} value={tf.value}>{tf.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Setup */}
            <div>
              <label htmlFor="setupId" className={labelClass} style={labelStyle}>
                Setup (optional)
              </label>
              <select
                id="setupId"
                name="setupId"
                className={inputClass}
                style={inputStyle()}
              >
                <option value="">— Manual (no setup) —</option>
                {setups.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className={labelClass} style={labelStyle}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={2}
                placeholder="What are you testing? What's the hypothesis?"
                className={inputClass}
                style={{ ...inputStyle(), resize: "none" }}
              />
            </div>
          </div>

          {/* Section: Period */}
          <div className="border-b border-t px-6 py-4" style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.01)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Period
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 py-6">
            <div>
              <label htmlFor="periodStart" className={labelClass} style={labelStyle}>
                Start Date <span style={{ color: "#f87171" }}>*</span>
              </label>
              <input
                id="periodStart"
                name="periodStart"
                type="date"
                required
                defaultValue={oneYearAgo}
                className={inputClass}
                style={inputStyle()}
              />
            </div>
            <div>
              <label htmlFor="periodEnd" className={labelClass} style={labelStyle}>
                End Date <span style={{ color: "#f87171" }}>*</span>
              </label>
              <input
                id="periodEnd"
                name="periodEnd"
                type="date"
                required
                defaultValue={today}
                className={inputClass}
                style={inputStyle()}
              />
            </div>
          </div>

          {/* Section: Capital & Risk */}
          <div className="border-b border-t px-6 py-4" style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.01)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Capital & Risk
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 px-6 py-6">
            <div>
              <label htmlFor="initialCapital" className={labelClass} style={labelStyle}>
                Initial Capital ($)
              </label>
              <input
                id="initialCapital"
                name="initialCapital"
                type="number"
                min="0"
                step="100"
                defaultValue={10000}
                className={inputClass}
                style={inputStyle()}
              />
            </div>
            <div>
              <label htmlFor="riskPerTrade" className={labelClass} style={labelStyle}>
                Risk per Trade (%)
              </label>
              <input
                id="riskPerTrade"
                name="riskPerTrade"
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={1}
                className={inputClass}
                style={inputStyle()}
              />
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex items-center justify-between border-t px-6 py-4"
            style={{ borderColor: "var(--border)" }}
          >
            <Link
              href="/backtest"
              className="text-base transition-colors hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-base font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: "var(--accent-primary)", color: "#1a1710" }}
            >
              <FlaskConical size={16} />
              Create Backtest
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
