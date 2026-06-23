"use client";

import { useState } from "react";
import type { PendingOrder } from "./useReplayEngine";

type Props = {
  currentPrice: number;
  currentBarIndex: number;
  onConfirm: (order: PendingOrder) => void;
  onCancel: () => void;
};

export function OrderPanel({ currentPrice, currentBarIndex, onConfirm, onCancel }: Props) {
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [entryPrice, setEntryPrice] = useState(currentPrice.toFixed(5));
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ep = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    if (isNaN(ep) || isNaN(sl) || isNaN(tp)) return;
    onConfirm({ direction, entryPrice: ep, stopLoss: sl, takeProfit: tp, entryBarIndex: currentBarIndex });
  }

  return (
    <div
      className="absolute bottom-24 right-4 z-20 w-72 rounded-2xl p-4 shadow-2xl"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        Place Order
      </p>

      <div className="mb-3 flex gap-2">
        {(["LONG", "SHORT"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className="flex-1 rounded-xl py-2 text-sm font-bold transition-all"
            style={{
              backgroundColor: direction === d ? (d === "LONG" ? "#22c55e" : "#ef4444") : "var(--bg-surface)",
              color: direction === d ? "#fff" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {d === "LONG" ? "LONG ▲" : "SHORT ▼"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {[
          { label: "Entry", value: entryPrice, onChange: setEntryPrice, placeholder: "" },
          { label: "Stop Loss", value: stopLoss, onChange: setStopLoss, placeholder: direction === "LONG" ? "< entry" : "> entry" },
          { label: "Take Profit", value: takeProfit, onChange: setTakeProfit, placeholder: direction === "LONG" ? "> entry" : "< entry" },
        ].map(({ label, value, onChange, placeholder }) => (
          <div key={label}>
            <label className="mb-0.5 block text-xs" style={{ color: "var(--text-muted)" }}>{label}</label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        ))}

        <div className="mt-2 flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-xl py-2 text-sm font-bold"
            style={{ backgroundColor: direction === "LONG" ? "#22c55e" : "#ef4444", color: "#fff" }}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl py-2 text-sm font-bold"
            style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
