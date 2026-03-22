"use client";

import { useState, useTransition } from "react";
import {
  TrendingUp, TrendingDown, Pencil, Trash2, Star, X, ExternalLink,
} from "lucide-react";
import { deleteTrade } from "./actions";
import { TradeForm, type Setup, type TradeData } from "./TradeForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/* ─── Types ─────────────────────────────────────────────────────────────── */
export interface TradeRowData extends TradeData {
  pnlNet: string | number | null;
  pnlGross: string | number | null;
  status: string;
  symbol: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtPnl(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtR(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "R";
}

function fmtPrice(v: string | number | null): string {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  // Detect decimal places needed
  const s = String(v);
  const dec = s.includes(".") ? s.split(".")[1].length : 0;
  return n.toFixed(Math.min(Math.max(dec, 2), 8));
}

function pnlColor(v: string | number | null): string {
  if (v == null) return "var(--text-muted)";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "var(--text-muted)";
  if (n > 0) return "var(--accent-tertiary-light)";
  if (n < 0) return "#f87171";
  return "var(--text-muted)";
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span style={{ color: "var(--text-muted)" }} className="text-sm">Open</span>;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    WIN:       { label: "Win",  color: "var(--accent-tertiary-light)", bg: "rgba(0,200,150,0.12)" },
    LOSS:      { label: "Loss", color: "#f87171",                      bg: "rgba(239,68,68,0.12)" },
    BREAKEVEN: { label: "B/E",  color: "var(--text-secondary)",        bg: "rgba(255,255,255,0.06)" },
  };
  const s = map[outcome] ?? map.BREAKEVEN;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.color}33` }}
    >
      {s.label}
    </span>
  );
}

function GradeStars({ score }: { score: number | null }) {
  if (!score) return <span style={{ color: "var(--text-muted)" }} className="text-sm">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={10}
          style={{ color: i < score ? "var(--accent-primary)" : "var(--text-muted)" }}
          fill={i < score ? "var(--accent-primary)" : "none"}
        />
      ))}
    </div>
  );
}

/* ─── TradeRow ──────────────────────────────────────────────────────────── */
export function TradeRow({ trade, setups }: { trade: TradeRowData; setups: Setup[] }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPendingDelete, startDeleteTransition] = useTransition();

  function handleDelete() {
    startDeleteTransition(async () => {
      await deleteTrade(trade.id);
      setConfirmDelete(false);
    });
  }

  if (editing) {
    return (
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-2" style={{ backgroundColor: "rgba(255,214,0,0.04)", borderBottom: "1px solid var(--border)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--accent-primary)" }}>
            Editing — {trade.symbol}
          </span>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={12} /> Close
          </button>
        </div>
        <TradeForm
          setups={setups}
          trade={trade}
          onSuccess={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {/* Direction icon */}
        <div className="shrink-0 w-6">
          {trade.direction === "LONG" ? (
            <TrendingUp size={14} style={{ color: "var(--accent-tertiary-light)" }} />
          ) : (
            <TrendingDown size={14} style={{ color: "#f87171" }} />
          )}
        </div>

        {/* Symbol + date */}
        <div className="min-w-0 w-32 shrink-0">
          <p className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {trade.symbol}
          </p>
          <p className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
            {fmtDate(trade.entryTime)} {fmtTime(trade.entryTime)}
          </p>
        </div>

        {/* Entry → Exit prices */}
        <div className="hidden sm:flex flex-col w-28 shrink-0">
          <p className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {fmtPrice(trade.entryPrice)}
            {trade.exitPrice && (
              <span style={{ color: "var(--text-muted)" }}> → {fmtPrice(trade.exitPrice)}</span>
            )}
          </p>
          {trade.stopLoss && (
            <p className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
              SL {fmtPrice(trade.stopLoss)}
            </p>
          )}
        </div>

        {/* Outcome */}
        <div className="w-16 shrink-0">
          <OutcomeBadge outcome={trade.outcome} />
        </div>

        {/* P&L */}
        <div className="hidden md:block w-20 shrink-0 text-right">
          <p className="text-base font-bold tabular-nums" style={{ color: pnlColor(trade.pnlNet) }}>
            {fmtPnl(trade.pnlNet)}
          </p>
          {trade.pnlNet != null && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>net</p>
          )}
        </div>

        {/* R-multiple */}
        <div className="hidden md:block w-16 shrink-0 text-right">
          <p
            className="text-base font-bold tabular-nums"
            style={{ color: trade.rMultiple != null ? pnlColor(trade.rMultiple) : "var(--text-muted)" }}
          >
            {fmtR(trade.rMultiple)}
          </p>
        </div>

        {/* Quality score */}
        <div className="hidden lg:flex w-20 shrink-0 justify-start">
          <GradeStars score={trade.qualityScore} />
        </div>

        {/* Tags */}
        <div className="hidden lg:flex flex-1 min-w-0 gap-1 flex-wrap">
          {trade.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-xs"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              {tag}
            </span>
          ))}
          {trade.tags.length > 3 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>+{trade.tags.length - 3}</span>
          )}
        </div>

        {/* Screenshot link */}
        {trade.screenshotUrl && (
          <a
            href={trade.screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden xl:flex shrink-0 items-center gap-1 text-xs hover:underline"
            style={{ color: "var(--accent-primary-light)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={10} /> Chart
          </a>
        )}

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            title="Edit trade"
            onClick={() => setEditing(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            title="Delete trade"
            onClick={() => setConfirmDelete(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
            style={{ color: "var(--text-muted)" }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this trade?"
        description={`${trade.direction} ${trade.symbol} on ${fmtDate(trade.entryTime)} will be permanently deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isPending={isPendingDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
