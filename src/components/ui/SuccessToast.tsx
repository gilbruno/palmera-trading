"use client";

import { useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { CheckCircle, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SuccessToastProps {
  /** Controls visibility */
  open: boolean;
  /** Main message */
  message: string;
  /** Optional sub-message */
  description?: string;
  /** Auto-dismiss delay in ms (0 = manual only). Default: 4000 */
  duration?: number;
  /** Called when the toast closes (auto or manual) */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SuccessToast({
  open,
  message,
  description,
  duration = 4000,
  onClose,
}: SuccessToastProps) {
  const toastRef   = useRef<HTMLDivElement>(null);
  const barRef     = useRef<HTMLDivElement>(null);
  const iconRingRef = useRef<HTMLDivElement>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barTween   = useRef<gsap.core.Tween | null>(null);

  const close = useCallback(() => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    if (barTween.current) barTween.current.kill();

    const toast = toastRef.current;
    if (!toast) { onClose(); return; }

    gsap.to(toast, {
      x: "110%",
      opacity: 0,
      duration: 0.35,
      ease: "power3.in",
      onComplete: onClose,
    });
  }, [onClose]);

  useEffect(() => {
    const toast = toastRef.current;
    const bar   = barRef.current;
    const ring  = iconRingRef.current;
    if (!toast) return;

    if (open) {
      // ── Enter animation ──────────────────────────────────────────────────
      gsap.set(toast, { x: "110%", opacity: 0 });
      gsap.to(toast, {
        x: "0%",
        opacity: 1,
        duration: 0.5,
        ease: "elastic.out(1, 0.65)",
      });

      // Icon ring pulse
      if (ring) {
        gsap.fromTo(
          ring,
          { scale: 0.6, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.55, ease: "elastic.out(1.2, 0.5)", delay: 0.1 }
        );
      }

      // Progress bar countdown
      if (bar && duration > 0) {
        gsap.set(bar, { scaleX: 1, transformOrigin: "left center" });
        barTween.current = gsap.to(bar, {
          scaleX: 0,
          duration: duration / 1000,
          ease: "none",
        });
        autoCloseTimer.current = setTimeout(close, duration);
      }

      return () => {
        if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
        if (barTween.current) barTween.current.kill();
      };
    } else {
      // Snap hide without animation when externally set to false
      gsap.set(toast, { x: "110%", opacity: 0 });
    }
  }, [open, duration, close]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&display=swap');

        .success-toast {
          position: fixed;
          bottom: 1.75rem;
          right: 1.75rem;
          z-index: 9999;
          min-width: 300px;
          max-width: 420px;
          background: var(--bg-card, #1a1710);
          border: 1px solid color-mix(in srgb, #00C896 28%, var(--border, #2e2a1a));
          border-radius: 12px;
          box-shadow:
            0 0 0 1px color-mix(in srgb, #00C896 10%, transparent),
            0 8px 40px -8px rgba(0,200,150,0.25),
            0 2px 16px -4px rgba(0,0,0,0.55);
          overflow: hidden;
          pointer-events: all;
          will-change: transform, opacity;
        }

        .success-toast__inner {
          display: flex;
          align-items: flex-start;
          gap: 0.9rem;
          padding: 1.1rem 1rem 1.25rem 1.1rem;
        }

        .success-toast__icon-ring {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: color-mix(in srgb, #00C896 12%, transparent);
          border: 1.5px solid color-mix(in srgb, #00C896 35%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          will-change: transform, opacity;
        }

        .success-toast__body {
          flex: 1;
          min-width: 0;
          padding-top: 0.05rem;
        }

        .success-toast__message {
          font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #00C896;
          line-height: 1.25;
          margin: 0 0 0.15rem;
        }

        .success-toast__description {
          font-size: 0.8rem;
          color: var(--text-secondary, #a89d7a);
          line-height: 1.5;
          margin: 0;
        }

        .success-toast__close {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          color: var(--text-muted, #5a5238);
          border-radius: 4px;
          transition: color 0.18s ease, background 0.18s ease;
          margin-top: -0.05rem;
        }

        .success-toast__close:hover {
          color: var(--text-secondary, #a89d7a);
          background: color-mix(in srgb, #fff 5%, transparent);
        }

        .success-toast__close:focus-visible {
          outline: 2px solid #00C896;
          outline-offset: 2px;
        }

        .success-toast__bar-track {
          height: 2px;
          background: color-mix(in srgb, #00C896 12%, transparent);
          position: relative;
        }

        .success-toast__bar {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #00C896, #00E6AC);
          transform-origin: left center;
          box-shadow: 0 0 6px rgba(0,200,150,0.6);
        }
      `}</style>

      <div
        ref={toastRef}
        className="success-toast"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Progress bar */}
        {duration > 0 && (
          <div className="success-toast__bar-track" aria-hidden="true">
            <div ref={barRef} className="success-toast__bar" />
          </div>
        )}

        <div className="success-toast__inner">
          {/* Icon */}
          <div ref={iconRingRef} className="success-toast__icon-ring" aria-hidden="true">
            <CheckCircle size={20} color="#00C896" strokeWidth={2} />
          </div>

          {/* Body */}
          <div className="success-toast__body">
            <p className="success-toast__message">{message}</p>
            {description && (
              <p className="success-toast__description">{description}</p>
            )}
          </div>

          {/* Close button */}
          <button
            className="success-toast__close"
            onClick={close}
            aria-label="Fermer la notification"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Usage example ────────────────────────────────────────────────────────────
//
// const [toastOpen, setToastOpen] = useState(false);
//
// <SuccessToast
//   open={toastOpen}
//   message="Setup enregistré"
//   description="Vos modifications ont bien été sauvegardées."
//   onClose={() => setToastOpen(false)}
// />
//
// // Trigger after a successful action:
// setToastOpen(true);
