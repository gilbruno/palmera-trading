"use client";

import { useState } from "react";

export function ActiveToggle({ defaultChecked = true }: { defaultChecked?: boolean }) {
  const [active, setActive] = useState(defaultChecked);

  return (
    <div
      className="flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 transition-colors duration-150"
      style={{
        backgroundColor: active ? "rgba(255,214,0,0.08)" : "var(--bg-input)",
        border: `1px solid ${active ? "rgba(255,214,0,0.35)" : "var(--border)"}`,
      }}
      onClick={() => setActive((v) => !v)}
    >
      {/* Hidden input for Server Action */}
      <input type="hidden" name="isActive" value={active ? "on" : "off"} />

      <div>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Active setup
        </p>
        <p className="text-xs" style={{ color: active ? "var(--accent-purple-light)" : "var(--text-muted)" }}>
          {active ? "Included in trade entry selection" : "Excluded from trade entry selection"}
        </p>
      </div>

      {/* Visual toggle */}
      <div
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
        style={{ backgroundColor: active ? "var(--accent-purple)" : "var(--border)" }}
        role="switch"
        aria-checked={active}
        aria-label="Active setup"
      >
        <span
          className="pointer-events-none absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200"
          style={{ transform: active ? "translateX(1.25rem)" : "translateX(0.125rem)" }}
        />
      </div>
    </div>
  );
}
