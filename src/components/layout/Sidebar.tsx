"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { BookOpen, TrendingUp, BarChart2, Calculator, Home, Menu, X } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeColor: string;
  activeBg: string;
  activeIconColor: string;
  exact?: boolean;
}

const navItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: <Home size={16} strokeWidth={1.75} />,
    activeColor: "#d1d5db",
    activeBg: "rgba(255,255,255,0.07)",
    activeIconColor: "#d1d5db",
    exact: true,
  },
  {
    label: "Playbook",
    href: "/setups",
    icon: <BookOpen size={16} strokeWidth={1.75} />,
    activeColor: "var(--accent-purple-light)",
    activeBg: "rgba(124,58,237,0.15)",
    activeIconColor: "var(--accent-purple-light)",
  },
  {
    label: "Trades",
    href: "/trades",
    icon: <TrendingUp size={16} strokeWidth={1.75} />,
    activeColor: "#d1d5db",
    activeBg: "rgba(255,255,255,0.07)",
    activeIconColor: "#d1d5db",
  },
  {
    label: "Journal",
    href: "/journal",
    icon: <BarChart2 size={16} strokeWidth={1.75} />,
    activeColor: "var(--accent-green-light)",
    activeBg: "rgba(16,185,129,0.15)",
    activeIconColor: "var(--accent-green-light)",
  },
  {
    label: "Position Size",
    href: "/position-size",
    icon: <Calculator size={16} strokeWidth={1.75} />,
    activeColor: "#fb923c",
    activeBg: "rgba(251,146,60,0.15)",
    activeIconColor: "#fb923c",
  },
];

/* ─── Sidebar content (shared between desktop and mobile) ─────────────── */
function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--accent-purple)" }}
        >
          <TrendingUp size={15} strokeWidth={2} color="#fff" />
        </div>
        <div>
          <span
            className="block text-sm font-bold tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            MyJournal
          </span>
          <span className="block text-[10px] leading-none" style={{ color: "var(--text-muted)" }}>
            Trading Journal
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-2 h-px" style={{ backgroundColor: "var(--border)" }} />

      {/* Nav label */}
      <p className="mb-1 px-5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        Navigation
      </p>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-1">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavClick}
                  className={[
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 outline-none",
                    "focus-visible:ring-2 focus-visible:ring-offset-1",
                    isActive ? "font-medium" : "hover:bg-white/5",
                  ].join(" ")}
                  style={
                    isActive
                      ? {
                          backgroundColor: item.activeBg,
                          color: item.activeColor,
                          "--tw-ring-color": item.activeColor,
                        } as React.CSSProperties
                      : {
                          color: "var(--text-secondary)",
                          "--tw-ring-color": "var(--accent-purple)",
                        } as React.CSSProperties
                  }
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                      style={{ backgroundColor: item.activeColor }}
                    />
                  )}

                  {/* Icon */}
                  <span
                    className="shrink-0 transition-colors duration-150"
                    style={{
                      color: isActive ? item.activeIconColor : "var(--text-muted)",
                    }}
                  >
                    {item.icon}
                  </span>

                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="mx-4 mt-2 h-px" style={{ backgroundColor: "var(--border)" }} />
      <div className="px-5 py-4">
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          v0.1.0
        </p>
      </div>
    </div>
  );
}

/* ─── Desktop sidebar (fixed, 240 px) ─────────────────────────────────── */
function DesktopSidebar() {
  return (
    <aside
      className="hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col"
      style={{
        backgroundColor: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border)",
      }}
    >
      <SidebarContent />
    </aside>
  );
}

/* ─── Mobile drawer ────────────────────────────────────────────────────── */
function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="lg:hidden">
      {/* Top bar */}
      <div
        className="flex h-14 items-center gap-3 border-b px-4"
        style={{ backgroundColor: "var(--bg-sidebar)", borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-lg p-1.5 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2"
          style={{ color: "var(--text-secondary)", "--tw-ring-color": "var(--accent-purple)" } as React.CSSProperties}
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--accent-purple)" }}
          >
            <TrendingUp size={12} strokeWidth={2} color="#fff" />
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            MyJournal
          </span>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={[
          "fixed inset-y-0 left-0 z-50 w-60 transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        style={{
          backgroundColor: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="absolute right-3 top-3 rounded-lg p-1.5 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2"
          style={{ color: "var(--text-secondary)", "--tw-ring-color": "var(--accent-purple)" } as React.CSSProperties}
        >
          <X size={16} />
        </button>
        <SidebarContent onNavClick={() => setOpen(false)} />
      </div>
    </div>
  );
}

/* ─── Public export ────────────────────────────────────────────────────── */
export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileDrawer />
    </>
  );
}
