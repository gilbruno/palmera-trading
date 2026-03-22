"use client";

import { useRef, ButtonHTMLAttributes } from "react";
import gsap from "gsap";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function PrimaryButton({
  children,
  size = "md",
  fullWidth = false,
  className = "",
  disabled,
  onClick,
  ...rest
}: PrimaryButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const scanRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);

  const sizes = {
    sm: { padding: "0.45rem 1.1rem", fontSize: "0.72rem", tracking: "0.2em" },
    md: { padding: "0.65rem 1.7rem", fontSize: "0.82rem", tracking: "0.22em" },
    lg: { padding: "0.85rem 2.2rem", fontSize: "0.95rem", tracking: "0.24em" },
  };

  function handleMouseEnter() {
    if (disabled) return;
    // Scan line sweep left→right
    gsap.fromTo(
      scanRef.current,
      { left: "-30%", opacity: 0.9 },
      { left: "120%", opacity: 0, duration: 0.55, ease: "power2.inOut" }
    );
    // Subtle lift
    gsap.to(btnRef.current, {
      y: -2,
      boxShadow: "0 8px 32px -4px rgba(255,214,0,0.45), 0 0 0 1px rgba(255,214,0,0.6)",
      duration: 0.25,
      ease: "power2.out",
    });
    // Glow pulse
    gsap.to(glowRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    });
  }

  function handleMouseLeave() {
    if (disabled) return;
    gsap.to(btnRef.current, {
      y: 0,
      boxShadow: "0 0px 0px 0px transparent",
      duration: 0.35,
      ease: "power3.out",
    });
    gsap.to(glowRef.current, {
      opacity: 0,
      duration: 0.35,
    });
  }

  function handleMouseDown() {
    if (disabled) return;
    gsap.to(btnRef.current, {
      scale: 0.96,
      y: 0,
      duration: 0.1,
      ease: "power3.out",
    });
  }

  function handleMouseUp() {
    if (disabled) return;
    gsap.to(btnRef.current, {
      scale: 1,
      duration: 0.3,
      ease: "elastic.out(1, 0.5)",
    });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&display=swap');

        .primary-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5em;
          font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          color: #1a1710;
          background: linear-gradient(135deg, #FFD600 0%, #FFA500 100%);
          border: none;
          outline: none;
          cursor: pointer;
          overflow: hidden;
          border-radius: 3px;
          transition: background 0.2s ease, opacity 0.2s ease;
          /* Subtle grain texture via pseudo */
        }

        .primary-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
          background-size: 120px;
          pointer-events: none;
          border-radius: inherit;
          mix-blend-mode: overlay;
        }

        .primary-btn:disabled {
          opacity: 0.38;
          cursor: not-allowed;
          filter: saturate(0.4);
        }

        .primary-btn:focus-visible {
          outline: 2px solid #FFD600;
          outline-offset: 3px;
        }

        .primary-btn-scan {
          position: absolute;
          top: 0;
          width: 28%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          pointer-events: none;
          opacity: 0;
          transform: skewX(-12deg);
        }

        .primary-btn-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(255,214,0,0.22) 0%, transparent 70%);
          pointer-events: none;
          opacity: 0;
        }
      `}</style>

      <button
        ref={btnRef}
        className={`primary-btn${fullWidth ? " w-full" : ""} ${className}`}
        style={{
          padding: sizes[size].padding,
          fontSize: sizes[size].fontSize,
          letterSpacing: sizes[size].tracking,
          width: fullWidth ? "100%" : undefined,
        }}
        disabled={disabled}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={onClick}
        {...rest}
      >
        {/* Scan sweep */}
        <span ref={scanRef} className="primary-btn-scan" aria-hidden="true" />
        {/* Top glow */}
        <span ref={glowRef} className="primary-btn-glow" aria-hidden="true" />
        {/* Label */}
        <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: "0.45em", letterSpacing: "inherit", lineHeight: 1 }}>
          {children}
        </span>
      </button>
    </>
  );
}
