"use client";

import { useState, useTransition } from "react";
import { deleteSetup } from "../actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteButton({ setupId }: { setupId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(() => deleteSetup(setupId));
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
        style={{
          backgroundColor: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          color: "#f87171",
        }}
      >
        {isPending ? "Deleting…" : "Delete"}
      </button>

      <ConfirmDialog
        open={open}
        title="Delete this setup?"
        description="This action is irreversible. The setup will be permanently deleted. Trades linked to it will not be deleted but will lose the setup reference."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
        isPending={isPending}
      />
    </>
  );
}
