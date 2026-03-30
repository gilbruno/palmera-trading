import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { IctConceptsClient } from "./IctConceptsClient";

export default async function IctConceptsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Header ── */}
      <div className="mb-10">
        <p
          className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          Education
        </p>
        <div className="flex items-end gap-4">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            ICT Concepts
          </h1>
          <span
            className="mb-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{
              backgroundColor: "rgba(129,140,248,0.15)",
              color: "#a5b4fc",
              border: "1px solid rgba(129,140,248,0.25)",
            }}
          >
            Educational
          </span>
        </div>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          Inner Circle Trader methodology &amp; Smart Money Concepts
        </p>
      </div>

      <IctConceptsClient />
    </div>
  );
}
