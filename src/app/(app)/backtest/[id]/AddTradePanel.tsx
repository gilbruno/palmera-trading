"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { AddTradeForm } from "./AddTradeForm";

export function AddTradePanel({ backtestId, instrument }: { backtestId: string; instrument: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-2xl transition-all"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 transition-colors hover:bg-white/[0.02]"
      >
        <span className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(255,214,0,0.12)", color: "var(--accent-primary)" }}
          >
            <Plus size={13} />
          </span>
          <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Add Trade
          </span>
        </span>
        <ChevronDown
          size={15}
          className="transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Collapsible body */}
      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AddTradeForm backtestId={backtestId} instrument={instrument} />
        </div>
      )}
    </div>
  );
}
