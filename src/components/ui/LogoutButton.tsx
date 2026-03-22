"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
      style={{
        color: "var(--text-secondary)",
        "--tw-ring-color": "var(--accent-primary)",
      } as React.CSSProperties}
    >
      <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
        <LogOut size={16} strokeWidth={1.75} />
      </span>
      {isPending ? "Signing out…" : "Sign Out"}
    </button>
  );
}
