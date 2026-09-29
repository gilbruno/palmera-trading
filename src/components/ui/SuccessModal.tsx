"use client";

import { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuccessModalProps {
  /** Controls visibility */
  open: boolean;
  /** Main message */
  message: string;
  /** Optional sub-message */
  description?: string;
  /** Auto-dismiss delay in ms (0 = manual only). Default: 1800 */
  duration?: number;
  /** Called once the exit animation has finished (auto or manual) */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SuccessModal({
  open,
  message,
  description,
  duration = 1800,
  onClose,
}: SuccessModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef     = useRef<HTMLDivElement>(null);
  const ringRef     = useRef<HTMLDivElement>(null);
  const checkRef    = useRef<SVGPathElement>(null);
  const barRef      = useRef<HTMLDivElement>(null);
  const closingRef  = useRef(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    timelineRef.current?.kill();

    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) { onClose(); return; }

    gsap.timeline({ onComplete: onClose })
      .to(card, { scale: 0.94, y: 12, opacity: 0, duration: 0.3, ease: "power2.in" })
      .to(backdrop, { opacity: 0, duration: 0.3, ease: "power1.out" }, "-=0.15");
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    closingRef.current = false;

    const backdrop = backdropRef.current;
    const card = cardRef.current;
    const ring = ringRef.current;
    const check = checkRef.current;
    const bar = barRef.current;
    if (!backdrop || !card) return;

    // ── Enter animation ────────────────────────────────────────────────────
    const tl = gsap.timeline();
    tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.out" })
      .fromTo(card,
        { scale: 0.88, y: 16, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.6)" },
        "-=0.1");
    if (ring) {
      tl.fromTo(ring, { scale: 0.4, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.55, ease: "elastic.out(1.2, 0.5)" }, "-=0.3");
    }
    if (check) {
      const len = check.getTotalLength();
      tl.fromTo(check, { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 0.4, ease: "power2.out" }, "-=0.35");
    }
    if (bar && duration > 0) {
      gsap.fromTo(bar, { scaleX: 1 }, { scaleX: 0, duration: duration / 1000, ease: "none" });
    }
    timelineRef.current = tl;

    if (duration > 0) autoCloseTimer.current = setTimeout(close, duration);

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      tl.kill();
    };
  }, [open, duration, close]);

  if (!open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={close}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(8,7,4,0.55)", backdropFilter: "blur(6px)", opacity: 0 }}
    >
      <div
        ref={cardRef}
        role="alertdialog"
        aria-live="assertive"
        aria-label={message}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl text-center"
        style={{
          background: "var(--bg-card, #1a1710)",
          border: "1px solid color-mix(in srgb, #00C896 28%, var(--border, #2e2a1a))",
          boxShadow:
            "0 0 0 1px color-mix(in srgb, #00C896 10%, transparent), 0 24px 80px -12px rgba(0,200,150,0.3), 0 8px 32px -8px rgba(0,0,0,0.6)",
          opacity: 0,
        }}
      >
        {/* Soft glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(0,200,150,0.18), transparent)" }}
        />

        <div className="relative flex flex-col items-center gap-3 px-8 pb-7 pt-8">
          <div
            ref={ringRef}
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              background: "color-mix(in srgb, #00C896 12%, transparent)",
              border: "1.5px solid color-mix(in srgb, #00C896 40%, transparent)",
              boxShadow: "0 0 24px rgba(0,200,150,0.25)",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path
                ref={checkRef}
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="#00C896"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p
            className="text-xl font-semibold uppercase tracking-wider"
            style={{ fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", color: "#00C896" }}
          >
            {message}
          </p>
          {description && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary, #a89d7a)" }}>
              {description}
            </p>
          )}
        </div>

        {/* Countdown bar */}
        {duration > 0 && (
          <div aria-hidden="true" className="relative h-[3px]" style={{ background: "color-mix(in srgb, #00C896 12%, transparent)" }}>
            <div
              ref={barRef}
              className="absolute inset-0 origin-left"
              style={{ background: "linear-gradient(90deg, #00C896, #00E6AC)", boxShadow: "0 0 6px rgba(0,200,150,0.6)" }}
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
