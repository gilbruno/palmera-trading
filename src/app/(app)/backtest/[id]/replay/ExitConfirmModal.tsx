"use client";

import { useState, useEffect } from "react";
import type { FilledTrade } from "./useReplayEngine";

type Props = {
  trade: FilledTrade;
  onSave: (notes: string) => Promise<void>;
  isSaving: boolean;
};

const fmtPrice = (n: number) => n.toFixed(5);
const fmtDate  = (ts: number) => new Date(ts * 1000).toUTCString().slice(0, 22);

export function ExitConfirmModal({ trade, onSave, isSaving }: Props) {
  const [notes, setNotes]   = useState("");
  const [fading, setFading] = useState(false);
  const [saved, setSaved]   = useState(false);

  const isWin       = trade.outcome === "WIN";
  const outcomeColor = isWin ? "#22c55e" : "#ef4444";
  const rSign        = trade.rMultiple >= 0 ? "+" : "";

  async function handleSave() {
    await onSave(notes);
    setSaved(true);
  }

  // Déclenche le fade-out 300ms après que saved=true
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setFading(true), 300);
    return () => clearTimeout(t);
  }, [saved]);

  const rows: [string, string][] = [
    ["Direction",  trade.order.direction],
    ["Entry",      fmtPrice(trade.order.entryPrice)],
    ["Exit",       fmtPrice(trade.exitPrice)],
    ["SL",         fmtPrice(trade.order.stopLoss)],
    ["TP",         fmtPrice(trade.order.takeProfit)],
    ["R-multiple", `${rSign}${trade.rMultiple}R`],
    ["P&L pts",    (trade.pnlPoints > 0 ? "+" : "") + trade.pnlPoints.toFixed(4)],
    ["Exit Date",  fmtDate(trade.exitBar.time)],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 1.5s ease-out" : undefined,
        pointerEvents: fading ? "none" : undefined,
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "#0f1117", border: "1px solid #1f2937" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#f9fafb" }}>
            Trade{" "}
            <span style={{ color: outcomeColor }}>{trade.outcome}</span>
          </h2>
          <span className="text-2xl font-black" style={{ color: outcomeColor }}>
            {rSign}{trade.rMultiple}R
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg px-3 py-2" style={{ backgroundColor: "#1f2937" }}>
              <p className="text-xs" style={{ color: "#6b7280" }}>{label}</p>
              <p className="font-mono font-semibold" style={{ color: "#f9fafb" }}>{value}</p>
            </div>
          ))}
        </div>

        {!saved && (
          <>
            <div className="mb-4">
              <label
                className="mb-1 block text-xs font-semibold uppercase tracking-widest"
                style={{ color: "#6b7280" }}
              >
                Notes (optionnel — OB, FVG, structure…)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl px-3 py-2 text-sm"
                style={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  color: "#f9fafb",
                  outline: "none",
                }}
                placeholder="ex: OB H4 respecté, FVG H1 comblé, Silver Bullet 10h…"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full cursor-pointer rounded-xl py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#6366f1", color: "#fff" }}
            >
              {isSaving ? "Sauvegarde…" : "Sauvegarder le trade"}
            </button>
          </>
        )}

        {saved && (
          <div className="flex items-center justify-center py-2">
            <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>
              ✓ Trade sauvegardé
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
