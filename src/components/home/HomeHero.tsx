"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { BookOpen, TrendingUp, BarChart2, ChevronRight } from "lucide-react";
import gsap from "gsap";

const cards = [
  {
    href: "/setups",
    icon: <BookOpen size={22} strokeWidth={1.75} />,
    iconBg: "rgba(124,58,237,0.85)",
    title: "Playbook",
    description: "Manage your trading setups, entry rules, and risk parameters.",
    cta: "Browse",
    ctaColor: "var(--accent-purple-light)",
    glowColor: "rgba(124,58,237,0.18)",
    shadowColor: "rgba(124,58,237,0.25)",
  },
  {
    href: "/trades",
    icon: <TrendingUp size={22} strokeWidth={1.75} />,
    iconBg: "rgba(60,60,60,0.9)",
    title: "Trades",
    description: "Log and review all your executed trades in one place.",
    cta: "Browse",
    ctaColor: "#a0a0a0",
    glowColor: "rgba(255,255,255,0.04)",
    shadowColor: "rgba(255,255,255,0.08)",
  },
  {
    href: "/journal",
    icon: <BarChart2 size={22} strokeWidth={1.75} />,
    iconBg: "rgba(16,185,129,0.85)",
    title: "Journal",
    description: "Daily session notes, performance snapshots, and insights.",
    cta: "Browse",
    ctaColor: "var(--accent-green-light)",
    glowColor: "rgba(16,185,129,0.15)",
    shadowColor: "rgba(16,185,129,0.2)",
  },
];

/* Split "MyJournal" into individual <span> elements via React — no innerHTML */
const TITLE = "MyJournal";
const titleChars = TITLE.split("");

export function HomeHero() {
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleCharsRef = useRef<HTMLSpanElement[]>([]);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Badge: slide down + fade in
      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: -20, scale: 0.92 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6 }
      );

      // Title: stagger letter reveal
      tl.fromTo(
        titleCharsRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.045,
          ease: "back.out(1.4)",
        },
        "-=0.2"
      );

      // Subtitle
      tl.fromTo(
        subtitleRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.55 },
        "-=0.25"
      );

      // Cards stagger
      if (cardsRef.current) {
        const cardEls = cardsRef.current.querySelectorAll("[data-card]");
        tl.fromTo(
          cardEls,
          { opacity: 0, y: 40, scale: 0.94 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.12,
            ease: "power3.out",
          },
          "-=0.2"
        );
      }

      // Footer
      tl.fromTo(
        footerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.4 },
        "-=0.1"
      );
    });

    return () => ctx.revert();
  }, []);

  function handleCardEnter(e: React.MouseEvent<HTMLAnchorElement>, shadowColor: string) {
    gsap.to(e.currentTarget, {
      scale: 1.03,
      y: -6,
      boxShadow: `0 20px 60px -10px ${shadowColor}`,
      duration: 0.3,
      ease: "power2.out",
    });
  }

  function handleCardLeave(e: React.MouseEvent<HTMLAnchorElement>) {
    gsap.to(e.currentTarget, {
      scale: 1,
      y: 0,
      boxShadow: "0 0px 0px 0px transparent",
      duration: 0.4,
      ease: "power3.out",
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Badge */}
      <div
        ref={badgeRef}
        className="mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
        style={{
          opacity: 0,
          backgroundColor: "rgba(124,58,237,0.25)",
          border: "1px solid rgba(124,58,237,0.4)",
          color: "#c4b5fd",
        }}
      >
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: "#34d399" }}
        />
        Trading Journal — Track your edge
      </div>

      {/* Title — letters split via React, no innerHTML */}
      <h1
        className="mb-3 text-center text-5xl font-bold tracking-tight"
        style={{ color: "#ffffff" }}
        aria-label={TITLE}
      >
        {titleChars.map((char, i) => (
          <span
            key={i}
            ref={(el) => { if (el) titleCharsRef.current[i] = el; }}
            style={{ display: "inline-block", opacity: 0 }}
            aria-hidden="true"
          >
            {char}
          </span>
        ))}
      </h1>

      {/* Subtitle */}
      <p
        ref={subtitleRef}
        className="mb-14 text-center text-base"
        style={{ opacity: 0, color: "var(--text-secondary)" }}
      >
        Track, analyse and improve your trading performance
      </p>

      {/* Cards */}
      <div
        ref={cardsRef}
        className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            data-card=""
            className="group relative overflow-hidden rounded-2xl p-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-purple)]"
            style={{
              opacity: 0,
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border)",
            }}
            onMouseEnter={(e) => handleCardEnter(e, card.shadowColor)}
            onMouseLeave={handleCardLeave}
          >
            {/* Corner glow */}
            <div
              className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full blur-2xl"
              style={{ backgroundColor: card.glowColor }}
            />

            {/* Icon */}
            <div
              className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: card.iconBg, color: "#fff" }}
            >
              {card.icon}
            </div>

            {/* Content */}
            <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {card.title}
            </h2>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {card.description}
            </p>

            {/* CTA */}
            <div
              className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: card.ctaColor }}
            >
              {card.cta}
              <ChevronRight
                size={14}
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <p
        ref={footerRef}
        className="mt-16 text-xs"
        style={{ opacity: 0, color: "var(--text-muted)" }}
      >
        MyJournal — powered by Next.js &amp; Prisma
      </p>
    </div>
  );
}
