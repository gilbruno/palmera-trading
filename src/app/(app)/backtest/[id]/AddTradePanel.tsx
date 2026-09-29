"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { AddTradeForm } from "./AddTradeForm";
import { SuccessToast } from "@/components/ui/SuccessToast";

interface AddTradePanelProps {
  backtestId: string;
  instrument: string;
  /** "YYYY-MM-DD" */
  periodStart: string;
  /** "YYYY-MM-DD" */
  periodEnd: string;
}

/** Duration of the collapse transition, in ms */
const COLLAPSE_MS = 350;

export function AddTradePanel({ backtestId, instrument, periodStart, periodEnd }: AddTradePanelProps) {
  const [open, setOpen] = useState(false);
  // Bumped after each save to remount the form with empty fields.
  const [formKey, setFormKey] = useState(0);
  // Backtests are logged chronologically: the next trade starts from the last one's entry date.
  const [lastEntryDate, setLastEntryDate] = useState<string | undefined>(undefined);
  const [toastOpen, setToastOpen] = useState(false);

  function handleSaved(entryDate: string) {
    setLastEntryDate(entryDate);
    setToastOpen(true);
    setOpen(false);
    // Reset the form once the collapse animation has finished.
    setTimeout(() => setFormKey((k) => k + 1), COLLAPSE_MS);
  }

  return (
    <>
      <div
        className="overflow-hidden rounded-2xl transition-all"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Toggle header */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
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

        {/* Collapsible body — grid-rows trick animates height smoothly */}
        <div
          className="grid transition-[grid-template-rows,opacity] ease-out"
          style={{
            gridTemplateRows: open ? "1fr" : "0fr",
            opacity: open ? 1 : 0,
            transitionDuration: `${COLLAPSE_MS}ms`,
          }}
          inert={!open}
        >
          <div className="min-h-0 overflow-hidden">
            <div style={{ borderTop: "1px solid var(--border)" }}>
              <AddTradeForm
                key={formKey}
                backtestId={backtestId}
                instrument={instrument}
                periodStart={periodStart}
                periodEnd={periodEnd}
                initialEntryDate={lastEntryDate}
                onSaved={handleSaved}
              />
            </div>
          </div>
        </div>
      </div>

      <SuccessToast
        open={toastOpen}
        message="Trade enregistré"
        description="Le trade a bien été ajouté au backtest."
        duration={3500}
        onClose={() => setToastOpen(false)}
      />
    </>
  );
}
