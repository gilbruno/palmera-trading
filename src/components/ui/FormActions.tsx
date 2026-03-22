"use client";

import Link from "next/link";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface FormActionsProps {
  cancelHref: string;
  submitLabel?: string;
}

export function FormActions({ cancelHref, submitLabel = "Save" }: FormActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link
        href={cancelHref}
        className="inline-flex items-center rounded-sm px-5 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.2em] transition-colors duration-150 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        style={{
          fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        Cancel
      </Link>
      <PrimaryButton type="submit">
        {submitLabel}
      </PrimaryButton>
    </div>
  );
}
