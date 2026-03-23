"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search } from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { DateTimePicker } from "@/components/ui/DateTimePicker";

const iStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--text-primary)",
  outline: "none",
};
const iCls =
  "block px-2.5 py-2 text-sm transition-all focus:ring-1 focus:ring-[var(--accent-primary)] placeholder:opacity-40";

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
      <div style={{ width: "7.5rem" }}>
        <Combobox
          name="direction"
          value={direction}
          onChange={(v) => update("direction", v)}
          placeholder="All directions"
          options={[
            { value: "", label: "All directions" },
            { value: "LONG", label: "Long only" },
            { value: "SHORT", label: "Short only" },
          ]}
        />
      </div>

      {/* Outcome */}
      <div style={{ width: "8rem" }}>
        <Combobox
          name="outcome"
          value={outcome}
          onChange={(v) => update("outcome", v)}
          placeholder="All outcomes"
          options={[
            { value: "", label: "All outcomes" },
            { value: "WIN", label: "Win" },
            { value: "LOSS", label: "Loss" },
            { value: "BREAKEVEN", label: "Breakeven" },
            { value: "OPEN", label: "Open" },
          ]}
        />
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1">
        <div style={{ width: "9rem" }}>
          <DateTimePicker
            name="from"
            value={from ? `${from}T00:00` : ""}
            onChange={(v) => update("from", v ? v.split("T")[0] : "")}
            placeholder="From date"
            dateOnly
          />
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
        <div style={{ width: "9rem" }}>
          <DateTimePicker
            name="to"
            value={to ? `${to}T00:00` : ""}
            onChange={(v) => update("to", v ? v.split("T")[0] : "")}
            placeholder="To date"
            dateOnly
          />
        </div>
      </div>
    </div>
  );
}
