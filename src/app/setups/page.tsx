import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { SetupModel as Setup } from "@/generated/prisma/models/Setup";
import { Plus, BookOpen, ChevronRight } from "lucide-react";

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function fmt(value: string | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  const n = parseFloat(value.toString());
  if (isNaN(n)) return "—";
  return n.toFixed(decimals);
}

/* ─── Sub-components ───────────────────────────────────────────────────── */
function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={
        isActive
          ? {
              backgroundColor: "rgba(16,185,129,0.15)",
              color: "var(--accent-green-light)",
              border: "1px solid rgba(16,185,129,0.3)",
            }
          : {
              backgroundColor: "rgba(255,255,255,0.04)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: isActive ? "var(--accent-green-light)" : "var(--text-muted)" }}
      />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)" }}
      >
        <BookOpen size={26} style={{ color: "var(--accent-purple-light)" }} />
      </div>
      <h3 className="mb-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        No setups yet
      </h3>
      <p className="mb-8 max-w-xs text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Create your first trading setup to start building your playbook.
      </p>
      <Link
        href="/setups/new"
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
        style={{
          backgroundColor: "var(--accent-purple)",
          color: "#fff",
          "--tw-ring-color": "var(--accent-purple)",
        } as React.CSSProperties}
      >
        <Plus size={15} />
        New Setup
      </Link>
    </div>
  );
}

function SetupRow({ setup }: { setup: Setup }) {
  return (
    <Link
      href={`/setups/${setup.id}`}
      className="group flex items-center gap-4 border-b px-6 py-4 transition-all duration-150 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset last:border-b-0"
      style={{
        borderColor: "var(--border)",
        "--tw-ring-color": "var(--accent-purple)",
      } as React.CSSProperties}
    >
      {/* Icon dot */}
      <div
        className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: "rgba(124,58,237,0.12)" }}
      >
        <BookOpen size={14} style={{ color: "var(--accent-purple-light)" }} />
      </div>

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {setup.name}
        </p>
        {setup.description && (
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
            {setup.description}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 shrink-0">
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
            Win %
          </p>
          <p
            className="text-sm font-bold tabular-nums"
            style={{ color: setup.winRate != null ? "var(--accent-green-light)" : "var(--text-muted)" }}
          >
            {setup.winRate != null ? `${fmt(setup.winRate.toString())}%` : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
            Avg R
          </p>
          <p
            className="text-sm font-bold tabular-nums"
            style={{
              color:
                setup.avgRMultiple != null
                  ? parseFloat(setup.avgRMultiple.toString()) >= 0
                    ? "var(--accent-green-light)"
                    : "var(--accent-red)"
                  : "var(--text-muted)",
            }}
          >
            {setup.avgRMultiple != null ? `${fmt(setup.avgRMultiple.toString(), 2)}R` : "—"}
          </p>
        </div>
      </div>

      {/* Badge */}
      <div className="shrink-0">
        <ActiveBadge isActive={setup.isActive} />
      </div>

      {/* Arrow */}
      <ChevronRight
        size={15}
        className="shrink-0 opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5"
        style={{ color: "var(--accent-purple-light)" }}
      />
    </Link>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default async function SetupsPage() {
  const setups = await prisma.setup.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(124,58,237,0.2)" }}
          >
            <BookOpen size={18} style={{ color: "var(--accent-purple-light)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Playbook
            </h1>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {setups.length > 0
                ? `${setups.length} setup${setups.length > 1 ? "s" : ""} defined`
                : "Define your trading setups and rules"}
            </p>
          </div>
        </div>
        <Link
          href="/setups/new"
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: "var(--accent-purple)",
            color: "#fff",
            "--tw-ring-color": "var(--accent-purple)",
          } as React.CSSProperties}
        >
          <Plus size={15} />
          New Setup
        </Link>
      </div>

      {/* Content */}
      {setups.length === 0 ? (
        <div
          className="rounded-2xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <EmptyState />
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {/* Table header */}
          <div
            className="flex items-center gap-4 border-b px-6 py-3"
            style={{ borderColor: "var(--border)", backgroundColor: "rgba(255,255,255,0.02)" }}
          >
            <div className="hidden sm:block w-8 shrink-0" />
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Setup
            </span>
            <span className="hidden sm:flex items-center gap-6 shrink-0">
              <span className="w-16 text-right text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Win %
              </span>
              <span className="w-12 text-right text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Avg R
              </span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Status
            </span>
            <span className="w-4" />
          </div>

          {/* Rows */}
          {setups.map((setup) => (
            <SetupRow key={setup.id} setup={setup} />
          ))}
        </div>
      )}
    </div>
  );
}
