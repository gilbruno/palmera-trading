"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, TrendingUp, BarChart2, ChevronRight } from "lucide-react";
import gsap from "gsap";

const cards = [
  {
    href: "/setups",
    icon: <BookOpen size={22} strokeWidth={1.75} />,
    iconBg: "rgba(255,214,0,0.9)",
    iconColor: "#1a1710",
    title: "Setups",
    description: "Manage your trading setups, entry rules, and risk parameters.",
    cta: "Browse",
    ctaColor: "var(--accent-primary-light)",
    glowColor: "rgba(255,214,0,0.15)",
    shadowColor: "rgba(255,214,0,0.35)",
  },
  {
    href: "/trades",
    icon: <TrendingUp size={22} strokeWidth={1.75} />,
    iconBg: "rgba(255,140,0,0.85)",
    iconColor: "#fff",
    title: "Trades",
    description: "Log and review all your executed trades in one place.",
    cta: "Browse",
    ctaColor: "var(--accent-secondary-light)",
    glowColor: "rgba(255,140,0,0.12)",
    shadowColor: "rgba(255,140,0,0.30)",
  },
  {
    href: "/journal",
    icon: <BarChart2 size={22} strokeWidth={1.75} />,
    iconBg: "rgba(0,200,150,0.85)",
    iconColor: "#fff",
    title: "Journal",
    description: "Daily session notes, performance snapshots, and insights.",
    cta: "Browse",
    ctaColor: "var(--accent-tertiary-light)",
    glowColor: "rgba(0,200,150,0.12)",
    shadowColor: "rgba(0,200,150,0.28)",
  },
];

/* Split "MyJournal" into individual <span> elements via React — no innerHTML */
const TITLE = "Palmera Trading";
const titleChars = TITLE.split("");

const TAGLINE = "Track your trading edge";

export function HomeHero() {
  const logoRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const titleCharsRef = useRef<HTMLSpanElement[]>([]);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      const logoImg = logoRef.current?.querySelector("img") ?? null;

      // Phase 1 — conteneur fade in instantané
      tl.set(logoRef.current, { opacity: 1 });

      if (!logoImg) return;

      // Phase 2 — zoom hauteur: scaleY 0→1 depuis le bas, elastic spectaculaire
      tl.fromTo(
        logoImg,
        { scaleY: 0, scaleX: 0.6, opacity: 0, transformOrigin: "bottom center", filter: "blur(6px)" },
        { scaleY: 1, scaleX: 1, opacity: 1, filter: "blur(0px)", duration: 1.1, ease: "elastic.out(1, 0.5)" }
      );

      // Phase 3 — halo doré qui pulse une fois après l'atterrissage
      tl.fromTo(
        logoImg,
        { filter: "drop-shadow(0 0 40px rgba(255,193,7,0.45)) drop-shadow(0 0 80px rgba(255,140,0,0.2))" },
        {
          filter: "drop-shadow(0 0 70px rgba(255,214,0,0.85)) drop-shadow(0 0 120px rgba(255,140,0,0.5))",
          duration: 0.35,
          ease: "power2.out",
          yoyo: true,
          repeat: 1,
        },
        "-=0.1"
      );

      // Phase 4 — breathing loop discret
      tl.to(
        logoImg,
        {
          scale: 1.04,
          duration: 2.8,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        },
        "+=0.1"
      );

      // Tagline: animate in then trigger CSS typewriter class
      tl.fromTo(
        taglineRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.01,
          onComplete: () => {
            taglineRef.current?.classList.add("typewriter-active");
          },
        },
        "<"
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
        "+=1.4"
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
    <>
      {/* Typewriter styles — scoped inline to avoid globals pollution */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&display=swap');

        .hero-tagline {
          font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
          font-size: clamp(1.35rem, 3.5vw, 2rem);
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          font-style: normal;
          background: linear-gradient(90deg, #FFD600 0%, #FF8C00 55%, #FFD600 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          /* Typewriter: hidden until active */
          overflow: hidden;
          white-space: nowrap;
          max-width: 0;
          border-right: 2px solid #FFD600;
          opacity: 0;
        }

        .hero-tagline.typewriter-active {
          opacity: 1;
          animation:
            hero-typing 1.4s steps(${TAGLINE.length}, end) 0.05s forwards,
            hero-cursor-blink 0.75s step-end 0.05s 3,
            hero-cursor-hide ${1.4 + 0.05 + 3 * 0.75}s forwards;
        }

        @keyframes hero-typing {
          from { max-width: 0; }
          to   { max-width: 38ch; }
        }

        @keyframes hero-cursor-blink {
          0%, 100% { border-right-color: #FFD600; }
          50%       { border-right-color: transparent; }
        }

        @keyframes hero-cursor-hide {
          to { border-right-color: transparent; }
        }
      `}</style>

      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        {/* Logo hero */}
        <div
          ref={logoRef}
          className="mb-6 flex flex-col items-center gap-5"
          style={{ opacity: 0 }}
        >
          <Image
            src="/images/palmera_trading.png"
            alt="Palmera Trading"
            width={280}
            height={280}
            className="object-contain"
            style={{
              height: "auto",
              filter: "drop-shadow(0 0 40px rgba(255,193,7,0.45)) drop-shadow(0 0 80px rgba(255,140,0,0.2))",
              transformOrigin: "bottom center",
            }}
            priority
          />

          {/* Tagline typewriter */}
          <p
            ref={taglineRef}
            className="hero-tagline"
            aria-label={TAGLINE}
          >
            {TAGLINE}
          </p>
        </div>

        {/* Title — letters split via React, no innerHTML */}
        <h1
          className="mb-3 text-center text-5xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
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

        {/* Subtitle spacer */}
        <div ref={subtitleRef} className="mb-14" />

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
                style={{ backgroundColor: card.iconBg, color: card.iconColor }}
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
          {/* MyJournal — powered by Next.js &amp; Prisma */}
        </p>
      </div>
    </>
  );
}
