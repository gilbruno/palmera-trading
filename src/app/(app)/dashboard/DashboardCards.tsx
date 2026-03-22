"use client";

import Link from "next/link";
import { BarChart2, FlaskConical, ChevronRight, BookOpen, TrendingUp, Calculator } from "lucide-react";

const sections = [
  {
    href: "/trades",
    icon: <BarChart2 size={28} strokeWidth={1.5} />,
    iconBg: "rgba(0,200,150,0.18)",
    iconColor: "var(--accent-tertiary-light)",
    title: "Journal",
    description:
      "Log your daily sessions, track your psychology, and surface patterns across your trading history.",
    cta: "Open Journal",
    ctaColor: "var(--accent-tertiary-light)",
    glowColor: "rgba(0,200,150,0.10)",
    shadowColor: "rgba(0,230,172,0.18)",
    badge: "Trading log",
    badgeBg: "rgba(0,200,150,0.12)",
    badgeBorder: "rgba(0,200,150,0.25)",
  },
  {
    href: "/backtest",
    icon: <FlaskConical size={28} strokeWidth={1.5} />,
    iconBg: "rgba(99,102,241,0.18)",
    iconColor: "#a5b4fc",
    title: "Backtest",
    description:
      "Replay historical setups, measure edge, and validate your strategies before risking real capital.",
    cta: "Run Backtest",
    ctaColor: "#a5b4fc",
    glowColor: "rgba(99,102,241,0.10)",
    shadowColor: "rgba(99,102,241,0.20)",
    badge: "Strategy lab",
    badgeBg: "rgba(99,102,241,0.12)",
    badgeBorder: "rgba(99,102,241,0.25)",
  },
];

const quickLinks = [
  {
    href: "/setups",
    icon: <BookOpen size={14} strokeWidth={1.75} />,
    label: "Setups",
    color: "var(--accent-primary-light)",
  },
  {
    href: "/trades",
    icon: <TrendingUp size={14} strokeWidth={1.75} />,
    label: "Trades",
    color: "var(--accent-secondary-light)",
  },
  {
    href: "/position-size",
    icon: <Calculator size={14} strokeWidth={1.75} />,
    label: "Position Size",
    color: "var(--accent-secondary)",
  },
];

export function DashboardCards() {
  return (
    <>
      {/* ── Main cards ── */}
      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {sections.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative overflow-hidden rounded-2xl p-7 outline-none transition-all duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:bg-white/[0.02] focus-visible:ring-2"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Corner glow */}
            <div
              className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full blur-3xl"
              style={{ backgroundColor: card.glowColor }}
            />

            {/* Badge */}
            <span
              className="mb-5 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{
                backgroundColor: card.badgeBg,
                border: `1px solid ${card.badgeBorder}`,
                color: card.ctaColor,
              }}
            >
              {card.badge}
            </span>

            {/* Icon */}
            <div
              className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: card.iconBg,
                color: card.iconColor,
              }}
            >
              {card.icon}
            </div>

            {/* Content */}
            <h2
              className="mb-2 text-xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {card.title}
            </h2>
            <p
              className="mb-7 text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {card.description}
            </p>

            {/* CTA */}
            <div
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: card.ctaColor }}
            >
              {card.cta}
              <ChevronRight
                size={15}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Quick links ── */}
      <div
        className="rounded-2xl px-6 py-4"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
        }}
      >
        <p
          className="mb-3 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Quick access
        </p>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all duration-150 hover:opacity-80"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                color: link.color,
              }}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
