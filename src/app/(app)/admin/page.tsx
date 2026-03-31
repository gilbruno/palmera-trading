import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserPerformanceSelector } from "./UserPerformanceSelector";

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Vérifier que l'utilisateur est ADMIN
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Récupérer tous les utilisateurs (sauf les admins)
  const users = await prisma.user.findMany({
    where: {
      role: "USER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      trades: {
        select: {
          id: true,
          pnlNet: true,
          outcome: true,
          createdAt: true,
        },
      },
      equitySnapshots: {
        select: {
          equity: true,
          date: true,
        },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Convertir les Decimal en nombres pour pouvoir les passer au Client Component
  const usersSerialized = users.map((user) => ({
    ...user,
    trades: user.trades.map((trade) => ({
      ...trade,
      pnlNet: trade.pnlNet?.toNumber() ?? null,
    })),
    equitySnapshots: user.equitySnapshots.map((snapshot) => ({
      ...snapshot,
      equity: snapshot.equity.toNumber(),
    })),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Header ── */}
      <div className="mb-10">
        <p
          className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          Administration
        </p>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Performance des Utilisateurs
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Sélectionnez un utilisateur pour voir ses performances détaillées
        </p>
      </div>

      {/* ── User Selector ── */}
      <UserPerformanceSelector users={usersSerialized} />
    </div>
  );
}
