"use client";

import { authClient } from "@/lib/auth-client";
import { ShieldCheck, BookOpen, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function AdminNavItem() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isAdminActive = pathname === "/admin" || pathname.startsWith("/admin/");
  const [open, setOpen] = useState(isAdminActive);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      const user = data?.user as { role?: string } | undefined;
      setIsAdmin(user?.role === "ADMIN");
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  if (isLoading || !isAdmin) return null;

  const isJournalActive = pathname.startsWith("/admin/journal");

  return (
    <div className="mt-3">
      <div className="mx-2 mb-2 h-px" style={{ backgroundColor: "var(--border)" }} />
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        Administration
      </p>

      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={[
          "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 outline-none",
          "focus-visible:ring-2 focus-visible:ring-offset-1",
          isAdminActive ? "font-medium" : "hover:bg-white/5",
        ].join(" ")}
        style={
          isAdminActive
            ? { backgroundColor: "rgba(255,197,24,0.12)", color: "#F5C518", "--tw-ring-color": "#F5C518" } as React.CSSProperties
            : { color: "var(--text-secondary)", "--tw-ring-color": "var(--accent-primary)" } as React.CSSProperties
        }
      >
        {isAdminActive && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: "#F5C518" }} />
        )}
        <span className="shrink-0 transition-colors duration-150" style={{ color: isAdminActive ? "#F5C518" : "var(--text-muted)" }}>
          <ShieldCheck size={16} strokeWidth={1.75} />
        </span>
        <span className="flex-1 text-left">Administration</span>
        <span
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", color: isAdminActive ? "#F5C518" : "var(--text-muted)" }}
        >
          <ChevronDown size={13} strokeWidth={2} />
        </span>
      </button>

      {/* Submenu */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? "120px" : "0px", opacity: open ? 1 : 0 }}
      >
        <ul className="mt-0.5 pl-3">
          <li>
            <Link
              href="/admin"
              className={[
                "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 outline-none",
                "focus-visible:ring-2 focus-visible:ring-offset-1",
                pathname === "/admin" ? "font-medium" : "hover:bg-white/5",
              ].join(" ")}
              style={
                pathname === "/admin"
                  ? { backgroundColor: "rgba(255,197,24,0.10)", color: "#F5C518", "--tw-ring-color": "#F5C518" } as React.CSSProperties
                  : { color: "var(--text-secondary)", "--tw-ring-color": "var(--accent-primary)" } as React.CSSProperties
              }
            >
              <span className="shrink-0" style={{ color: pathname === "/admin" ? "#F5C518" : "var(--text-muted)" }}>
                <ShieldCheck size={13} strokeWidth={1.75} />
              </span>
              Performances
            </Link>
          </li>
          <li>
            <Link
              href="/admin/journal"
              className={[
                "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 outline-none",
                "focus-visible:ring-2 focus-visible:ring-offset-1",
                isJournalActive ? "font-medium" : "hover:bg-white/5",
              ].join(" ")}
              style={
                isJournalActive
                  ? { backgroundColor: "rgba(255,197,24,0.10)", color: "#F5C518", "--tw-ring-color": "#F5C518" } as React.CSSProperties
                  : { color: "var(--text-secondary)", "--tw-ring-color": "var(--accent-primary)" } as React.CSSProperties
              }
            >
              <span className="shrink-0" style={{ color: isJournalActive ? "#F5C518" : "var(--text-muted)" }}>
                <BookOpen size={13} strokeWidth={1.75} />
              </span>
              Journal
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
