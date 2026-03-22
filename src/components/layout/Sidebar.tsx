"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { BookOpen, TrendingUp, BookMarked, Calculator, FlaskConical, Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/ui/LogoutButton";

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
    label: "Setups",
    href: "/setups",
    icon: <BookOpen size={16} strokeWidth={1.75} />,
    activeColor: "var(--accent-primary-light)",
    activeBg: "rgba(255,214,0,0.12)",
    activeIconColor: "var(--accent-primary-light)",
  },
  {
    label: "Trades",
    href: "/trades",
    icon: <TrendingUp size={16} strokeWidth={1.75} />,
    activeColor: "var(--accent-tertiary-light)",
    activeBg: "rgba(0,200,150,0.12)",
    activeIconColor: "var(--accent-tertiary-light)",
  },
  {
    label: "Backtest",
    href: "/backtest",
    icon: <FlaskConical size={16} strokeWidth={1.75} />,
    activeColor: "#a5b4fc",
    activeBg: "rgba(99,102,241,0.12)",
    activeIconColor: "#a5b4fc",
  },
  {
    label: "Position Size",
    href: "/position-size",
    icon: <Calculator size={16} strokeWidth={1.75} />,
    activeColor: "var(--accent-secondary)",
    activeBg: "rgba(255,140,0,0.10)",
    activeIconColor: "var(--accent-secondary)",
  },
];

/* ─── Sidebar content (shared between desktop and mobile) ─────────────── */
function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-20 items-center px-5">
        <Link href="/dashboard" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 rounded-lg" style={{ "--tw-ring-color": "var(--accent-primary)" } as React.CSSProperties}>
          <Image
            src="/images/palmera_trading.png"
            alt="Palmera Trading"
            width={110}
            height={110}
            className="object-contain shrink-0"
            style={{ height: "auto" }}
            priority
          />
          <span
            className="leading-tight"
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "1.25rem",
              fontWeight: 500,
              letterSpacing: "0.02em",
              color: "#F5C518",
            }}
          >
            Palmera<br />
            <span style={{ fontStyle: "italic", fontWeight: 300, fontSize: "1.05rem" }}>Trading</span>
          </span>
        </Link>
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
                          "--tw-ring-color": "var(--accent-primary)",
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
      <div className="px-3 py-3">
        <LogoutButton />
        <p className="mt-2 px-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
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
          style={{ color: "var(--text-secondary)", "--tw-ring-color": "var(--accent-primary)" } as React.CSSProperties}
        >
          <Menu size={18} />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 rounded-lg" style={{ "--tw-ring-color": "var(--accent-primary)" } as React.CSSProperties}>
          <Image
            src="/images/palmera_trading.png"
            alt="Palmera Trading"
            width={80}
            height={80}
            className="object-contain shrink-0"
            style={{ height: "auto" }}
            priority
          />
          <span
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "1.15rem",
              fontWeight: 500,
              letterSpacing: "0.02em",
              color: "#F5C518",
            }}
          >
            Palmera <span style={{ fontStyle: "italic", fontWeight: 300 }}>Trading</span>
          </span>
        </Link>
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
          style={{ color: "var(--text-secondary)", "--tw-ring-color": "var(--accent-primary)" } as React.CSSProperties}
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
