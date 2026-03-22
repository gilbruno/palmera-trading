"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";

const iStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--text-primary)",
  outline: "none",
};
const iCls =
  "block px-2.5 py-2 text-sm transition-all focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:opacity-40";
const sCls = `${iCls} appearance-none`;

export function TradesFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filter changes
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const symbol = searchParams.get("symbol") ?? "";
  const direction = searchParams.get("direction") ?? "";
  const outcome = searchParams.get("outcome") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Symbol search */}
      <div className="relative">
        <Search
          size={12}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          placeholder="Symbol…"
          defaultValue={symbol}
          onChange={(e) => update("symbol", e.target.value)}
          className={iCls}
          style={{ ...iStyle, paddingLeft: "1.75rem", width: "9rem" }}
        />
      </div>

      {/* Direction */}
      <select
        defaultValue={direction}
        onChange={(e) => update("direction", e.target.value)}
        className={sCls}
        style={{ ...iStyle, width: "7.5rem" }}
      >
        <option value="">All directions</option>
        <option value="LONG">Long only</option>
        <option value="SHORT">Short only</option>
      </select>

      {/* Outcome */}
      <select
        defaultValue={outcome}
        onChange={(e) => update("outcome", e.target.value)}
        className={sCls}
        style={{ ...iStyle, width: "8rem" }}
      >
        <option value="">All outcomes</option>
        <option value="WIN">Win</option>
        <option value="LOSS">Loss</option>
        <option value="BREAKEVEN">Breakeven</option>
        <option value="OPEN">Open</option>
      </select>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          defaultValue={from}
          onChange={(e) => update("from", e.target.value)}
          title="From date"
          className={iCls}
          style={{ ...iStyle, width: "8.5rem", colorScheme: "dark" }}
        />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
        <input
          type="date"
          defaultValue={to}
          onChange={(e) => update("to", e.target.value)}
          title="To date"
          className={iCls}
          style={{ ...iStyle, width: "8.5rem", colorScheme: "dark" }}
        />
      </div>
    </div>
  );
}
