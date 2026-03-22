"use client";

import { useRef, useEffect, useId, useCallback } from "react";
import gsap from "gsap";
import { Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = "danger" | "warning" | "default";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

// ─── Variant config ───────────────────────────────────────────────────────────

interface VariantConfig {
  titleColor: string;
  iconColor: string;
  Icon: typeof Trash2;
  confirmBg: string;
  confirmHoverShadow: string;
  confirmGlowColor: string;
  confirmTextColor: string;
}

const VARIANT_CONFIG: Record<Variant, VariantConfig> = {
  danger: {
    titleColor: "#ef4444",
    iconColor: "#ef4444",
    Icon: Trash2,
    confirmBg: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    confirmHoverShadow: "0 8px 32px -4px rgba(239,68,68,0.45), 0 0 0 1px rgba(239,68,68,0.6)",
    confirmGlowColor: "rgba(239,68,68,0.22)",
    confirmTextColor: "#fff",
  },
  warning: {
    titleColor: "#FF8C00",
    iconColor: "#FF8C00",
    Icon: AlertTriangle,
    confirmBg: "linear-gradient(135deg, #FFA500 0%, #FF8C00 100%)",
    confirmHoverShadow: "0 8px 32px -4px rgba(255,140,0,0.45), 0 0 0 1px rgba(255,140,0,0.6)",
    confirmGlowColor: "rgba(255,140,0,0.22)",
    confirmTextColor: "#1a1710",
  },
  default: {
    titleColor: "#FFD600",
    iconColor: "#FFD600",
    Icon: CheckCircle,
    confirmBg: "linear-gradient(135deg, #FFD600 0%, #FFA500 100%)",
    confirmHoverShadow: "0 8px 32px -4px rgba(255,214,0,0.45), 0 0 0 1px rgba(255,214,0,0.6)",
    confirmGlowColor: "rgba(255,214,0,0.22)",
    confirmTextColor: "#1a1710",
  },
};

// ─── Custom confirm button for danger / warning variants ──────────────────────

interface VariantButtonProps {
  label: string;
  config: VariantConfig;
  disabled: boolean;
  onClick: () => void;
}

function VariantConfirmButton({ label, config, disabled, onClick }: VariantButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const scanRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);

  function handleMouseEnter() {
    if (disabled) return;
    gsap.fromTo(
      scanRef.current,
      { left: "-30%", opacity: 0.9 },
      { left: "120%", opacity: 0, duration: 0.55, ease: "power2.inOut" }
    );
    gsap.to(btnRef.current, {
      y: -2,
      boxShadow: config.confirmHoverShadow,
      duration: 0.25,
      ease: "power2.out",
    });
    gsap.to(glowRef.current, { opacity: 1, duration: 0.3, ease: "power2.out" });
  }

  function handleMouseLeave() {
    if (disabled) return;
    gsap.to(btnRef.current, {
      y: 0,
      boxShadow: "0 0px 0px 0px transparent",
      duration: 0.35,
      ease: "power3.out",
    });
    gsap.to(glowRef.current, { opacity: 0, duration: 0.35 });
  }

  function handleMouseDown() {
    if (disabled) return;
    gsap.to(btnRef.current, { scale: 0.96, y: 0, duration: 0.1, ease: "power3.out" });
  }

  function handleMouseUp() {
    if (disabled) return;
    gsap.to(btnRef.current, { scale: 1, duration: 0.3, ease: "elastic.out(1, 0.5)" });
  }

  return (
    <button
      ref={btnRef}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5em",
        fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.22em",
        fontSize: "0.82rem",
        padding: "0.65rem 1.7rem",
        color: config.confirmTextColor,
        background: config.confirmBg,
        border: "none",
        outline: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        overflow: "hidden",
        borderRadius: "3px",
        opacity: disabled ? 0.38 : 1,
        filter: disabled ? "saturate(0.4)" : undefined,
        transition: "opacity 0.2s ease",
      }}
    >
      {/* Scan sweep */}
      <span
        ref={scanRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          width: "28%",
          height: "100%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
          pointerEvents: "none",
          opacity: 0,
          transform: "skewX(-12deg)",
        }}
      />
      {/* Top glow */}
      <span
        ref={glowRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${config.confirmGlowColor} 0%, transparent 70%)`,
          pointerEvents: "none",
          opacity: 0,
        }}
      />
      <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: "0.45em", lineHeight: 1 }}>
        {label}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
  onConfirm,
  onCancel,
  isPending = false,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Tracks whether the dialog is mounted in the DOM (survives the exit animation)
  const isMountedRef = useRef(false);
  const titleId = useId();
  const descId = useId();

  const config = VARIANT_CONFIG[variant];
  const { Icon } = config;

  // ── Escape key ──────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onCancel();
    },
    [isPending, onCancel]
  );

  // ── Animate in / out on `open` change ───────────────────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    const card = cardRef.current;
    if (!overlay || !card) return;

    if (open) {
      isMountedRef.current = true;

      // Ensure starting state before animating in
      gsap.set(overlay, { opacity: 0 });
      gsap.set(card, { scale: 0.9, y: 20, opacity: 0 });

      const ctx = gsap.context(() => {
        gsap.to(overlay, { opacity: 1, duration: 0.3, ease: "power2.out" });
        gsap.to(card, {
          scale: 1,
          y: 0,
          opacity: 1,
          duration: 0.4,
          ease: "elastic.out(1, 0.6)",
        });
      });

      // Focus cancel button after animation starts
      const focusTimer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 80);

      // Keyboard listener
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        ctx.revert();
        clearTimeout(focusTimer);
        document.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      // Animate out
      document.removeEventListener("keydown", handleKeyDown);

      const ctx = gsap.context(() => {
        gsap.to(overlay, { opacity: 0, duration: 0.22, ease: "power2.in" });
        gsap.to(card, {
          scale: 0.9,
          y: 20,
          opacity: 0,
          duration: 0.22,
          ease: "power2.in",
        });
      });

      return () => {
        ctx.revert();
      };
    }
  }, [open, handleKeyDown]);

  // Cancel button hover — secondary style
  const cancelBtnEnter = useCallback(() => {
    if (isPending) return;
    gsap.to(cancelBtnRef.current, {
      y: -1,
      borderColor: "var(--text-secondary)",
      duration: 0.2,
      ease: "power2.out",
    });
  }, [isPending]);

  const cancelBtnLeave = useCallback(() => {
    gsap.to(cancelBtnRef.current, {
      y: 0,
      borderColor: "var(--border)",
      duration: 0.25,
      ease: "power3.out",
    });
  }, []);

  // Always render; control visibility via opacity / pointer-events
  // This lets the exit animation play before the element disappears.
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&display=swap');
        .confirm-dialog-cancel:focus-visible {
          outline: 2px solid var(--border);
          outline-offset: 3px;
        }
      `}</style>

      {/* Overlay */}
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(e) => {
          // Close only when clicking the overlay itself, not the card
          if (e.target === overlayRef.current && !isPending) onCancel();
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          // Hide completely when closed and animation is done;
          // visibility ensures it's not focusable when invisible
          visibility: open ? "visible" : "hidden",
          opacity: 0, // GSAP controls this
        }}
      >
        {/* Card */}
        <div
          ref={cardRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: "420px",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            boxShadow: "0 4px 40px -8px rgba(255,214,0,0.12), 0 0 0 0px transparent",
            padding: "2rem 1.75rem 1.75rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0",
            opacity: 0, // GSAP controls this
          }}
        >
          {/* Icon */}
          <div
            aria-hidden="true"
            style={{
              marginBottom: "1.1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: `color-mix(in srgb, ${config.iconColor} 12%, transparent)`,
              border: `1.5px solid color-mix(in srgb, ${config.iconColor} 30%, transparent)`,
            }}
          >
            <Icon size={26} color={config.iconColor} strokeWidth={1.75} />
          </div>

          {/* Title */}
          <h2
            id={titleId}
            style={{
              margin: 0,
              marginBottom: description ? "0.55rem" : "1.5rem",
              fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
              fontWeight: 600,
              fontSize: "1.15rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: config.titleColor,
              textAlign: "center",
              lineHeight: 1.25,
            }}
          >
            {title}
          </h2>

          {/* Description */}
          {description && (
            <p
              id={descId}
              style={{
                margin: 0,
                marginBottom: "1.5rem",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                textAlign: "center",
                lineHeight: 1.55,
              }}
            >
              {description}
            </p>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              width: "100%",
              justifyContent: "center",
            }}
          >
            {/* Cancel */}
            <button
              ref={cancelBtnRef}
              className="confirm-dialog-cancel"
              disabled={isPending}
              onClick={onCancel}
              onMouseEnter={cancelBtnEnter}
              onMouseLeave={cancelBtnLeave}
              style={{
                flex: 1,
                fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                fontSize: "0.82rem",
                padding: "0.65rem 1.2rem",
                color: "var(--text-secondary)",
                backgroundColor: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "3px",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.5 : 1,
                transition: "opacity 0.2s ease, color 0.2s ease",
              }}
            >
              {cancelLabel}
            </button>

            {/* Confirm */}
            <div style={{ flex: 1, display: "flex" }}>
              {variant === "default" ? (
                <PrimaryButton
                  fullWidth
                  disabled={isPending}
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </PrimaryButton>
              ) : (
                <VariantConfirmButton
                  label={confirmLabel}
                  config={config}
                  disabled={isPending}
                  onClick={onConfirm}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Usage example ────────────────────────────────────────────────────────────
//
// <ConfirmDialog
//   open={isOpen}
//   title="Supprimer ce setup ?"
//   description="Cette action est irréversible. Le setup sera définitivement supprimé."
//   confirmLabel="Supprimer"
//   variant="danger"
//   onConfirm={handleDelete}
//   onCancel={() => setIsOpen(false)}
//   isPending={isPending}
// />
