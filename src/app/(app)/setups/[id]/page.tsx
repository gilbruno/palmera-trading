import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ArrowLeft, BookOpen } from "lucide-react";
import { updateSetup } from "../actions";
import { ActiveToggle } from "@/components/ui/ActiveToggle";
import { FormActions } from "@/components/ui/FormActions";
import { DeleteButton } from "./DeleteButton";
import { calculateSetupPerformance } from "@/lib/utils/setup-stats";

/* ─── Field primitives ─────────────────────────────────────────────────── */
function Label({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
      {required && (
        <span className="ml-1" style={{ color: "var(--accent-purple-light)" }}>
          *
        </span>
      )}
    </label>
  );
}

const inputBase: React.CSSProperties = {
  backgroundColor: "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  outline: "none",
  borderRadius: "0.75rem",
};

function TextInput({
  id,
  name,
  placeholder,
  required,
  maxLength,
  defaultValue,
}: {
  id: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  defaultValue?: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type="text"
      required={required}
      maxLength={maxLength}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="block w-full px-3.5 py-2.5 text-sm transition-colors placeholder:opacity-40 focus:border-[var(--accent-purple-light)] focus:ring-1 focus:ring-[var(--accent-purple-light)]"
      style={inputBase}
    />
  );
}

function Textarea({
  id,
  name,
  placeholder,
  rows = 4,
  defaultValue,
}: {
  id: string;
  name: string;
  placeholder?: string;
  rows?: number;
  defaultValue?: string;
}) {
  return (
    <textarea
      id={id}
      name={name}
      rows={rows}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      className="block w-full resize-y px-3.5 py-2.5 text-sm leading-relaxed transition-colors placeholder:opacity-40 focus:border-[var(--accent-purple-light)] focus:ring-1 focus:ring-[var(--accent-purple-light)]"
      style={{ ...inputBase, fontFamily: "var(--font-geist-mono), monospace" }}
    />
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mb-4 rounded-2xl p-6"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <h2
        className="mb-5 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

/* ─── Stat pill ────────────────────────────────────────────────────────── */
function StatPill({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean | null;
}) {
  const color =
    positive == null
      ? "var(--text-muted)"
      : positive
      ? "var(--accent-green-light)"
      : "var(--accent-red)";

  return (
    <div
      className="flex flex-col items-center rounded-xl px-5 py-3"
      style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
    >
      <span
        className="mb-1 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span className="text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default async function SetupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const setup = await prisma.setup.findFirst({
    where: { id, userId: session.user.id },
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

  if (!setup) notFound();

  const performance = calculateSetupPerformance(setup.trades);

  const fmt = (v: number | null, dec = 2) =>
    v == null ? "—" : v.toFixed(dec);

  const winRateNum = performance.winRate;
  const avgRNum = performance.avgRMultiple;

  const updateWithId = updateSetup.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back link */}
      <Link
        href="/setups"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:rounded-lg"
        style={{
          color: "var(--text-secondary)",
          "--tw-ring-color": "var(--accent-purple)",
        } as React.CSSProperties}
      >
        <ArrowLeft size={13} />
        Back to Setups
      </Link>

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
              {setup.name}
            </h1>
            {setup.description && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {setup.description}
              </p>
            )}
          </div>
        </div>
        <DeleteButton setupId={setup.id} />
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill
          label="Win Rate"
          value={winRateNum != null ? `${fmt(winRateNum)}%` : "—"}
          positive={winRateNum != null ? winRateNum >= 50 : null}
        />
        <StatPill
          label="Avg R"
          value={avgRNum != null ? `${fmt(avgRNum, 2)}R` : "—"}
          positive={avgRNum != null ? avgRNum >= 0 : null}
        />
        <StatPill
          label="Closed Trades"
          value={performance.closedTrades.toString()}
          positive={null}
        />
        <StatPill
          label="Status"
          value={setup.isActive ? "Active" : "Inactive"}
          positive={setup.isActive ? true : null}
        />
      </div>

      {/* Edit form */}
      <form action={updateWithId} noValidate>
        {/* ── Identity ── */}
        <SectionCard title="Identity">
          <div className="space-y-5">
            <div>
              <Label htmlFor="name" required>
                Name
              </Label>
              <TextInput
                id="name"
                name="name"
                required
                maxLength={100}
                defaultValue={setup.name}
                placeholder="e.g. ICT Breaker Block Long"
              />
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Must be unique. Max 100 characters.
              </p>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <TextInput
                id="description"
                name="description"
                maxLength={500}
                defaultValue={setup.description ?? ""}
                placeholder="Short description of the setup context and edge"
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Rules ── */}
        <SectionCard title="Rules">
          <div className="space-y-5">
            <div>
              <Label htmlFor="entryRules">Entry Rules</Label>
              <Textarea
                id="entryRules"
                name="entryRules"
                rows={5}
                defaultValue={setup.entryRules ?? ""}
                placeholder={"1. Price must tap into a premium/discount zone\n2. Confirmation candle close required\n3. ..."}
              />
            </div>
            <div>
              <Label htmlFor="exitRules">Exit Rules</Label>
              <Textarea
                id="exitRules"
                name="exitRules"
                rows={4}
                defaultValue={setup.exitRules ?? ""}
                placeholder={"1. TP at next liquidity pool\n2. Partial exit at 1R\n3. ..."}
              />
            </div>
            <div>
              <Label htmlFor="riskRules">Risk Rules</Label>
              <Textarea
                id="riskRules"
                name="riskRules"
                rows={3}
                defaultValue={setup.riskRules ?? ""}
                placeholder={"- Max risk per trade: 1%\n- No trade within 5 min of news\n- ..."}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Notes + Status ── */}
        <SectionCard title="Notes & Status">
          <div className="space-y-5">
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={setup.notes ?? ""}
                placeholder="Observations, edge statistics, market conditions where this works best…"
              />
            </div>
            <ActiveToggle defaultChecked={setup.isActive} />
          </div>
        </SectionCard>

        {/* ── Actions ── */}
        <FormActions cancelHref="/setups" submitLabel="Save Changes" />
      </form>
    </div>
  );
}
