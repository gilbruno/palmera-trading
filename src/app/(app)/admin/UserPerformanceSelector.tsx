"use client";

import { useState } from "react";
import { ChevronDown, TrendingUp, Target, Activity } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  trades: Array<{
    id: string;
    pnlNet: number | null;
    outcome: "WIN" | "LOSS" | "BREAKEVEN" | null;
    createdAt: Date;
  }>;
  equitySnapshots: Array<{
    equity: number;
    date: Date;
  }>;
}

interface UserPerformanceSelectorProps {
  users: User[];
}

export function UserPerformanceSelector({ users }: UserPerformanceSelectorProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  // Calculer les statistiques pour un utilisateur
  const calculateStats = (user: User) => {
    const trades = user.trades;
    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.outcome === "WIN").length;
    const losses = trades.filter((t) => t.outcome === "LOSS").length;
    const breakevens = trades.filter((t) => t.outcome === "BREAKEVEN").length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnlNet ?? 0), 0);
    const avgWin = wins > 0 ? trades.filter((t) => t.outcome === "WIN").reduce((sum, t) => sum + (t.pnlNet ?? 0), 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(trades.filter((t) => t.outcome === "LOSS").reduce((sum, t) => sum + (t.pnlNet ?? 0), 0) / losses) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
    const latestEquity = user.equitySnapshots.length > 0 ? user.equitySnapshots[0].equity : 0;

    return {
      totalTrades,
      wins,
      losses,
      breakevens,
      winRate,
      totalPnl,
      avgWin,
      avgLoss,
      profitFactor,
      latestEquity,
    };
  };

  return (
    <div className="space-y-6">
      {/* ── User Dropdown ─────────────────────────────────────────────── */}
      <div className="relative">
        <label
          className="mb-2 block text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Sélectionner un utilisateur
        </label>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            "--tw-ring-color": "var(--accent-primary)",
          } as React.CSSProperties}
        >
          <span className="text-sm">
            {selectedUser ? `${selectedUser.name} (${selectedUser.email})` : "Choisir un utilisateur..."}
          </span>
          <ChevronDown
            size={18}
            className="transition-transform"
            style={{
              color: "var(--text-muted)",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <ul
              className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border shadow-lg"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
              } as React.CSSProperties}
            >
              {users.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{user.name}</div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {user.email}
                      </div>
                    </div>
                    {user.trades.length > 0 && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: "rgba(0, 200, 150, 0.15)",
                          color: "var(--accent-tertiary-light)",
                        }}
                      >
                        {user.trades.length} trades
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {users.length === 0 && (
                <li
                  className="px-4 py-6 text-center text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Aucun utilisateur trouvé
                </li>
              )}
            </ul>
          </>
        )}
      </div>

      {/* ── Performance Stats ─────────────────────────────────────────── */}
      {selectedUser && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<TrendingUp size={20} />}
            label="P&L Total"
            value={`${calculateStats(selectedUser).totalPnl.toFixed(2)} USD`}
            trend={calculateStats(selectedUser).totalPnl >= 0 ? "positive" : "negative"}
          />
          <StatCard
            icon={<Target size={20} />}
            label="Win Rate"
            value={`${calculateStats(selectedUser).winRate.toFixed(1)}%`}
            trend={calculateStats(selectedUser).winRate >= 50 ? "positive" : "negative"}
          />
          <StatCard
            icon={<Activity size={20} />}
            label="Total Trades"
            value={calculateStats(selectedUser).totalTrades.toString()}
            trend="neutral"
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Profit Factor"
            value={
              calculateStats(selectedUser).profitFactor === Infinity
                ? "∞"
                : calculateStats(selectedUser).profitFactor.toFixed(2)
            }
            trend={calculateStats(selectedUser).profitFactor >= 1.5 ? "positive" : "negative"}
          />
        </div>
      )}

      {/* ── Detailed Stats Table ─────────────────────────────────────── */}
      {selectedUser && (
        <div
          className="rounded-xl border"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="border-b px-6 py-4"
            style={{ borderColor: "var(--border)" }}
          >
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Statistiques détaillées
            </h3>
          </div>
          <div className="p-6">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Wins" value={calculateStats(selectedUser).wins.toString()} />
              <DetailItem label="Losses" value={calculateStats(selectedUser).losses.toString()} />
              <DetailItem label="Breakevens" value={calculateStats(selectedUser).breakevens.toString()} />
              <DetailItem label="Avg Win" value={`${calculateStats(selectedUser).avgWin.toFixed(2)} USD`} />
              <DetailItem label="Avg Loss" value={`${calculateStats(selectedUser).avgLoss.toFixed(2)} USD`} />
              <DetailItem label="Equity Actuelle" value={`${calculateStats(selectedUser).latestEquity.toFixed(2)} USD`} />
              <DetailItem
                label="Membre depuis"
                value={new Date(selectedUser.createdAt).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stat Card Component ─────────────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: "positive" | "negative" | "neutral";
}) {
  const trendColors = {
    positive: "rgba(0, 200, 150, 0.15)",
    negative: "rgba(255, 80, 80, 0.15)",
    neutral: "var(--bg-tertiary)",
  };

  const textColors = {
    positive: "var(--accent-tertiary-light)",
    negative: "var(--accent-destructive)",
    neutral: "var(--text-primary)",
  };

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      } as React.CSSProperties}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: trendColors[trend] }}
        >
          <span style={{ color: textColors[trend] }}>{icon}</span>
        </div>
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-2xl font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Detail Item Component ───────────────────────────────────────────── */
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-4 py-3">
      <dt
        className="mb-1 text-xs font-medium uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </dt>
      <dd
        className="text-lg font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </dd>
    </div>
  );
}
