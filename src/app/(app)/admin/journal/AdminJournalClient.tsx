"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import { useState } from "react";
import { TradeRow, type TradeRowData } from "@/app/(app)/trades/TradeRow";

interface UserOption {
  id: string;
  name: string;
  email: string;
  tradeCount: number;
}

interface Setup {
  id: string;
  name: string;
}

interface AdminJournalClientProps {
  users: UserOption[];
  selectedUserId: string | null;
  trades: TradeRowData[];
  setups: Setup[];
  stats: {
    totalAll: number;
    open: number;
    wins: number;
    losses: number;
    winrate: number | null;
    profitFactor: number | null;
    expectancy: number | null;
    totalPnl: number;
    totalR: number;
  } | null;
}

function fmtPnl(v: number) {
  return (v >= 0 ? "+" : "") + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number | null) { return v != null ? v.toFixed(1) + "%" : "—"; }
function fmtPF(v: number | null) {
  if (v == null) return "—";
  if (!isFinite(v)) return "∞";
  return v.toFixed(2);
}
function fmtR(v: number | null) {
  if (v == null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "R";
}

function KpiCell({ label, value, positive, neutral, sub }: {
  label: string; value: string; positive?: boolean; neutral?: boolean; sub?: string;
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
      className="flex flex-col items-center justify-center rounded-xl px-3 py-3 text-center"
      style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
    >
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)", letterSpacing: "0.12em" }}>
        {label}
      </p>
      <p className="text-lg font-bold tabular-nums leading-none" style={{ color }}>{value}</p>
      {sub && <p className="mt-1 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

export function AdminJournalClient({ users, selectedUserId, trades, setups, stats }: AdminJournalClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  function selectUser(userId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("userId", userId);
    router.push(`/admin/journal?${params.toString()}`);
    setDropdownOpen(false);
  }

  return (
    <div className="space-y-6">
      {/* ── User Dropdown ── */}
      <div className="relative">
        <label className="mb-2 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Sélectionner un utilisateur
        </label>
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            "--tw-ring-color": "var(--accent-primary)",
          } as React.CSSProperties}
        >
          <span className="text-sm">
            {selectedUser ? `${selectedUser.name} (${selectedUser.email})` : "Choisir un utilisateur…"}
          </span>
          <ChevronDown
            size={18}
            className="transition-transform"
            style={{ color: "var(--text-muted)", transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <ul
              className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border shadow-lg"
              style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
            >
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => selectUser(user.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</div>
                    </div>
                    {user.tradeCount > 0 && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: "rgba(0,200,150,0.15)", color: "var(--accent-tertiary-light)" }}
                      >
                        {user.tradeCount} trades
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {users.length === 0 && (
                <li className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Aucun utilisateur trouvé
                </li>
              )}
            </ul>
          </>
        )}
      </div>

      {/* ── KPI bar ── */}
      {stats && selectedUser && (
        stats.totalAll > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-8">
            <KpiCell label="Trades"        value={String(stats.totalAll)}               neutral />
            <KpiCell label="Win Rate"      value={fmtPct(stats.winrate)}                positive={(stats.winrate ?? 0) >= 50} />
            <KpiCell label="Profit Factor" value={fmtPF(stats.profitFactor)}            positive={stats.profitFactor !== null && (isFinite(stats.profitFactor) ? stats.profitFactor >= 1 : true)} />
            <KpiCell label="Expectancy"    value={fmtR(stats.expectancy)}               positive={(stats.expectancy ?? 0) > 0} />
            <KpiCell label="Total P&L"     value={fmtPnl(stats.totalPnl)}               positive={stats.totalPnl >= 0} />
            <KpiCell label="Total R"       value={fmtR(stats.totalR)}                   positive={(stats.totalR ?? 0) > 0} />
            <KpiCell label="Wins"          value={String(stats.wins)}                   positive sub={`/ ${stats.wins + stats.losses} closed`} />
            <KpiCell label="Losses"        value={String(stats.losses)}                 positive={false} sub={`${stats.open} open`} />
          </div>
        ) : (
          <div
            className="flex items-center gap-3 rounded-2xl px-6 py-4"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <BarChart2 size={16} />
            <p className="text-base">Cet utilisateur n&apos;a pas encore de trades.</p>
          </div>
        )
      )}

      {/* ── Trade table ── */}
      {selectedUser && trades.length > 0 && (
        <div
          className="overflow-hidden rounded-2xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {/* Table header */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <p className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                Trades ({trades.length})
              </p>
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
            </div>
          </div>

          {/* Column headers */}
          <div
            className="flex items-center gap-3 border-b px-5 py-2"
            style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.01)" }}
          >
            <span className="w-6 shrink-0" />
            <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Symbol / Date</span>
            <span className="hidden sm:block w-28 shrink-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Prices</span>
            <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Result</span>
            <span className="hidden md:block w-20 shrink-0 text-right text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>P&L Net</span>
            <span className="hidden md:block w-16 shrink-0 text-right text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>R</span>
            <span className="hidden lg:block w-20 shrink-0 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Quality</span>
            <span className="hidden lg:flex flex-1 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Tags</span>
            <span className="ml-auto w-16 shrink-0" />
          </div>

          {/* Rows (read-only: no setups passed for edit) */}
          <div>
            {trades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} setups={setups} />
            ))}
          </div>
        </div>
      )}

      {/* Placeholder when no user selected */}
      {!selectedUser && (
        <div
          className="flex items-center gap-3 rounded-2xl px-6 py-8"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <BarChart2 size={16} />
          <p className="text-base">Sélectionnez un utilisateur pour voir son journal de trading.</p>
        </div>
      )}
    </div>
  );
}
