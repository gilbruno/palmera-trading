"use client";

import { useState } from "react";
import type { FilledTrade } from "./useReplayEngine";

type Props = {
  trade: FilledTrade;
  onSave: (notes: string) => void;
  onDiscard: () => void;
  isSaving: boolean;
};

export function TradeResultModal({ trade, onSave, onDiscard, isSaving }: Props) {
  const [notes, setNotes] = useState("");

  const isWin = trade.outcome === "WIN";
  const outcomeColor = isWin ? "#22c55e" : "#ef4444";

  const fmt = (ts: number) =>
    new Date(ts * 1000).toUTCString().slice(0, 22);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Trade {trade.outcome}
          </h2>
          <span className="text-2xl font-black" style={{ color: outcomeColor }}>
            {trade.rMultiple > 0 ? "+" : ""}{trade.rMultiple}R
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          {([
            ["Direction", trade.order.direction],
            ["Entry",     trade.order.entryPrice.toFixed(5)],
            ["Exit",      trade.exitPrice.toFixed(5)],
            ["SL",        trade.order.stopLoss.toFixed(5)],
            ["TP",        trade.order.takeProfit.toFixed(5)],
            ["P&L pts",   (trade.pnlPoints > 0 ? "+" : "") + trade.pnlPoints.toFixed(4)],
            ["Entry date", fmt(trade.entryBar.time)],
            ["Exit date",  fmt(trade.exitBar.time)],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Notes (optionnel — PD Array HTF, structure…)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            placeholder="ex: OB H4 respecté, FVG H1 comblé, Silver Bullet 10h…"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onSave(notes)}
            disabled={isSaving}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}
          >
            {isSaving ? "Saving…" : "Save Trade"}
          </button>
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
