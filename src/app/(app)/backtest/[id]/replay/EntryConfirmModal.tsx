"use client";

import type { Bar } from "./useReplayEngine";

type OverlaySummary = {
  direction: "LONG" | "SHORT";
  entry: number;
  sl: number;
  tp: number;
};

type Props = {
  overlayState: OverlaySummary;
  entryBar: Bar;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
};

const fmtPrice = (n: number) => n.toFixed(5);
const fmtDate  = (ts: number) => new Date(ts * 1000).toUTCString().slice(0, 22);

export function EntryConfirmModal({ overlayState, entryBar, onConfirm, onCancel, isSaving }: Props) {
  const isLong = overlayState.direction === "LONG";
  const dirColor = isLong ? "#22c55e" : "#ef4444";

  const rows: [string, string][] = [
    ["Direction",   overlayState.direction],
    ["Entry Price", fmtPrice(overlayState.entry)],
    ["Stop Loss",   fmtPrice(overlayState.sl)],
    ["Take Profit", fmtPrice(overlayState.tp)],
    ["Entry Date",  fmtDate(entryBar.time)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "#0f1117", border: "1px solid #1f2937" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "#f9fafb" }}>
            Confirmer l&apos;entrée
          </h2>
          <span
            className="rounded-lg px-2 py-0.5 text-xs font-bold uppercase"
            style={{ backgroundColor: dirColor + "22", color: dirColor }}
          >
            {overlayState.direction}
          </span>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-2">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ backgroundColor: "#1f2937" }}
            >
              <span className="text-xs" style={{ color: "#6b7280" }}>{label}</span>
              <span className="font-mono text-sm font-semibold" style={{ color: "#f9fafb" }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}
          >
            {isSaving ? "Placement…" : "Placer l'ordre"}
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ backgroundColor: "#1f2937", color: "#6b7280", border: "1px solid #374151" }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
