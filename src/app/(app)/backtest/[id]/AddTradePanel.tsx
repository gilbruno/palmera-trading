"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { AddTradeForm } from "./AddTradeForm";
import gsap from "gsap";
import { SuccessModal } from "@/components/ui/SuccessModal";

interface AddTradePanelProps {
  backtestId: string;
  instrument: string;
  /** "YYYY-MM-DD" */
  periodStart: string;
  /** "YYYY-MM-DD" */
  periodEnd: string;
  /** ISO — exit date of the last trade (entry if still open) */
  lastTradeEnd?: string;
}

/** Duration of the collapse transition, in ms */
const COLLAPSE_MS = 350;

export function AddTradePanel({ backtestId, instrument, periodStart, periodEnd, lastTradeEnd }: AddTradePanelProps) {
  const [open, setOpen] = useState(false);
  // Bumped after each save to remount the form with empty fields.
  const [formKey, setFormKey] = useState(0);
  const [savedTradeId, setSavedTradeId] = useState<string | null>(null);

  // Step 1 — trade persisted: show the success modal.
  function handleSaved(tradeId: string) {
    setSavedTradeId(tradeId);
  }

  // Step 2 — modal faded out: collapse the form.
  // Step 3 — collapse finished: reset the form and scroll to the saved trade.
  function handleModalClosed() {
    const tradeId = savedTradeId;
    setSavedTradeId(null);
    setOpen(false);
    setTimeout(() => {
      setFormKey((k) => k + 1);
      const row = tradeId ? document.querySelector<HTMLElement>(`[data-trade-id="${tradeId}"]`) : null;
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight so the eye lands on the new trade.
      gsap.fromTo(row,
        { boxShadow: "0 0 0 2px rgba(0,200,150,0.7), 0 0 24px rgba(0,200,150,0.35)" },
        { boxShadow: "0 0 0 0px rgba(0,200,150,0), 0 0 0px rgba(0,200,150,0)", duration: 1.6, delay: 0.5, ease: "power2.out", clearProps: "boxShadow" });
    }, COLLAPSE_MS);
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
                // Also remount when the last trade changes (edit/delete) so the entry-date prefill stays in sync.
                key={`${formKey}-${lastTradeEnd ?? ""}`}
                backtestId={backtestId}
                instrument={instrument}
                periodStart={periodStart}
                periodEnd={periodEnd}
                lastTradeEnd={lastTradeEnd}
                onSaved={handleSaved}
              />
            </div>
          </div>
        </div>
      </div>

      <SuccessModal
        open={savedTradeId !== null}
        message="Trade enregistré"
        description="Le trade a bien été ajouté au backtest."
        onClose={handleModalClosed}
      />
    </>
  );
}
