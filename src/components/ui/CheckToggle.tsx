"use client";

import { useState } from "react";

interface CheckToggleProps {
  name: string;
  label: string;
  defaultChecked?: boolean;
  /** Optional extra content rendered after the label (e.g. a Tip icon) */
  children?: React.ReactNode;
}

export function CheckToggle({ name, label, defaultChecked = false, children }: CheckToggleProps) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => setChecked((v) => !v)}
      onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setChecked((v) => !v)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        cursor: "pointer",
        width: "100%",
      }}
    >
      {/* Hidden input for form submission */}
      {checked && <input type="hidden" name={name} value="true" />}

      {/* Toggle pill */}
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          flexShrink: 0,
          width: 32,
          height: 18,
          borderRadius: 9999,
          backgroundColor: checked ? "var(--accent-primary)" : "var(--border)",
          border: `1px solid ${checked ? "var(--accent-primary)" : "var(--border)"}`,
          transition: "background-color 0.18s ease, border-color 0.18s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 1,
            left: checked ? 15 : 1,
            width: 14,
            height: 14,
            borderRadius: "50%",
            backgroundColor: checked ? "#1a1710" : "var(--text-muted)",
            transition: "left 0.18s ease, background-color 0.18s ease",
            boxShadow: checked ? "0 1px 4px rgba(255,214,0,0.3)" : "none",
          }}
        />
      </span>

      {/* Label */}
      <span
        style={{
          fontSize: "0.8rem",
          color: checked ? "var(--text-primary)" : "var(--text-secondary)",
          transition: "color 0.15s ease",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>

      {/* Slot for Tip or other extras */}
      {children}
    </div>
  );
}
