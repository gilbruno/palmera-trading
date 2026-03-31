"use client";

import { authClient } from "@/lib/auth-client";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AdminNavItem() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch session on client side only
    authClient.getSession().then(({ data }) => {
      // Cast to include role field (BetterAuth custom field)
      const user = data?.user as { role?: string } | undefined;
      setIsAdmin(user?.role === "ADMIN");
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return null;
  }

  if (!isAdmin) {
    return null;
  }

  const isActive = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <>
      <div className="mt-3">
        <div className="mx-2 mb-2 h-px" style={{ backgroundColor: "var(--border)" }} />
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          Administration
        </p>

        <Link
          href="/admin"
          className={[
            "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 outline-none",
            "focus-visible:ring-2 focus-visible:ring-offset-1",
            isActive ? "font-medium" : "hover:bg-white/5",
          ].join(" ")}
          style={
            isActive
              ? {
                  backgroundColor: "rgba(255,197,24,0.12)",
                  color: "#F5C518",
                  "--tw-ring-color": "#F5C518",
                } as React.CSSProperties
              : {
                  color: "var(--text-secondary)",
                  "--tw-ring-color": "var(--accent-primary)",
                } as React.CSSProperties
          }
        >
          {isActive && (
            <span
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
              style={{ backgroundColor: "#F5C518" }}
            />
          )}

          <span
            className="shrink-0 transition-colors duration-150"
            style={{ color: isActive ? "#F5C518" : "var(--text-muted)" }}
          >
            <ShieldCheck size={16} strokeWidth={1.75} />
          </span>

          Administration
        </Link>
      </div>
    </>
  );
}
