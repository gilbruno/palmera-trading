"use client";

import { useState, useTransition } from "react";
import { deleteBacktest } from "../actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteButton({ backtestId }: { backtestId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(() => deleteBacktest(backtestId));
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
        style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>

      <ConfirmDialog
        open={open}
        title="Supprimer ce backtest ?"
        description="Cette action est irréversible. Le backtest et tous ses trades seront définitivement supprimés."
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
        isPending={isPending}
      />
    </>
  );
}
