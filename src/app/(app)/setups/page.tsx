import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { SetupModel as Setup } from "@/generated/prisma/models/Setup";
import { Plus, BookOpen, ChevronRight } from "lucide-react";
import { NewSetupButton } from "@/components/ui/NewSetupButton";
import { calculateSetupPerformance, type TradeMetrics } from "@/lib/utils/setup-stats";

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
        style={{ backgroundColor: "rgba(255,214,0,0.12)", border: "1px solid rgba(255,214,0,0.25)" }}
      >
        <BookOpen size={26} style={{ color: "var(--accent-purple-light)" }} />
      </div>
      <h3 className="mb-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        No setups yet
      </h3>
      <p className="mb-8 max-w-xs text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Create your first trading setup to start building your playbook.
      </p>
      <NewSetupButton />
    </div>
  );
}

interface SetupRowProps {
  setup: Setup;
  trades: TradeMetrics[];
}

function SetupRow({ setup, trades }: SetupRowProps) {
  const performance = calculateSetupPerformance(trades);

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
        style={{ backgroundColor: "rgba(255,214,0,0.12)" }}
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
            style={{
              color: performance.winRate != null ? "var(--accent-green-light)" : "var(--text-muted)",
            }}
          >
            {performance.winRate != null ? `${fmt(performance.winRate.toString())}%` : "—"}
          </p>
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
            {performance.closedTrades} trades
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
                performance.avgRMultiple != null
                  ? performance.avgRMultiple >= 0
                    ? "var(--accent-green-light)"
                    : "var(--accent-red)"
                  : "var(--text-muted)",
            }}
          >
            {performance.avgRMultiple != null ? `${fmt(performance.avgRMultiple.toString(), 2)}R` : "—"}
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const setups = await prisma.setup.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      trades: {
        select: {
          id: true,
          outcome: true,
          pnlNet: true,
          rMultiple: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(255,214,0,0.2)" }}
          >
            <BookOpen size={18} style={{ color: "var(--accent-purple-light)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Setups
            </h1>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {setups.length > 0
                ? `${setups.length} setup${setups.length > 1 ? "s" : ""} defined`
                : "Define your trading setups and rules"}
            </p>
          </div>
        </div>
        <NewSetupButton />
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
            <SetupRow key={setup.id} setup={setup} trades={setup.trades} />
          ))}
        </div>
      )}
    </div>
  );
}
