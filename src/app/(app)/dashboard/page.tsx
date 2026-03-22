import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardCards } from "./DashboardCards";
import { WeeklyEconomicCard } from "./WeeklyEconomicCard";

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const firstName = session.user.name?.split(" ")[0] ?? "Trader";
  return (
    <div className="mx-auto max-w-4xl">

      {/* ── Header ── */}
      <div className="mb-10">
        <p
          className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          Welcome back
        </p>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {firstName}
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Your trading hub — pick up where you left off.
        </p>
      </div>

      <WeeklyEconomicCard />
      <DashboardCards />
    </div>
  );
}
