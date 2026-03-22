import { Calendar, TrendingUp, AlertTriangle } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface EconomicEvent {
  date: string;
  country: string;
  impact: string;
  title: string;
  actual?: string;
  forecast: string;
  previous: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const MAJOR_CURRENCIES = new Set(["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "NZD"]);

const CURRENCY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  USD: { bg: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.4)",  text: "#93c5fd" },
  EUR: { bg: "rgba(96,165,250,0.15)",  border: "rgba(96,165,250,0.4)",  text: "#bfdbfe" },
  GBP: { bg: "rgba(139,92,246,0.15)",  border: "rgba(139,92,246,0.4)",  text: "#c4b5fd" },
  JPY: { bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.4)",   text: "#fca5a5" },
  CAD: { bg: "rgba(248,113,113,0.15)", border: "rgba(248,113,113,0.4)", text: "#fca5a5" },
  AUD: { bg: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.4)",   text: "#86efac" },
  CHF: { bg: "rgba(220,38,38,0.15)",   border: "rgba(220,38,38,0.4)",   text: "#fca5a5" },
  NZD: { bg: "rgba(52,211,153,0.15)",  border: "rgba(52,211,153,0.4)",  text: "#6ee7b7" },
};

const IMPACT_STYLES = {
  High: {
    bg: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.4)",
    text: "#f87171",
    dot: "#ef4444",
  },
  Medium: {
    bg: "rgba(255,214,0,0.12)",
    border: "rgba(255,214,0,0.3)",
    text: "var(--accent-primary-light)",
    dot: "#FFD600",
  },
};

/* ─── Data fetching ─────────────────────────────────────────────────────── */
async function fetchEconomicEvents(): Promise<EconomicEvent[] | null> {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  const url = isWeekend
    ? "https://nfs.faireconomy.media/ff_calendar_nextweek.json"
    : "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function formatDayHeader(dateStr: string): string {
  // dateStr is "YYYY-MM-DD" (key from groupByDate)
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function groupByDate(events: EconomicEvent[]): Map<string, EconomicEvent[]> {
  const map = new Map<string, EconomicEvent[]>();
  for (const ev of events) {
    const key = ev.date.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export async function WeeklyEconomicCard() {
  let raw = await fetchEconomicEvents();
  if (!raw) {
    return (
      <div
        className="mb-8 rounded-2xl p-6"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
          <AlertTriangle size={18} />
          <p className="text-sm">Economic calendar unavailable — could not reach ForexFactory.</p>
        </div>
      </div>
    );
  }

  const filtered = raw
    .filter(
      (ev) =>
        MAJOR_CURRENCIES.has(ev.country) &&
        (ev.impact === "High" || ev.impact === "Medium")
    )
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.impact === "High" ? -1 : 1;
    });

  if (filtered.length === 0) return null;

  const highCount = filtered.filter((ev) => ev.impact === "High").length;
  const grouped = groupByDate(filtered);

  return (
    <div
      className="mb-8 overflow-hidden rounded-2xl"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-start justify-between px-6 py-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(255,214,0,0.12)", color: "var(--accent-primary)" }}
          >
            <Calendar size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Weekly Economic Calendar
            </h2>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Next week&apos;s key events — High &amp; Medium impact
            </p>
          </div>
        </div>

        {highCount > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} style={{ color: "#f87171" }} />
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#f87171",
              }}
            >
              {highCount} High impact
            </span>
          </div>
        )}
      </div>

      {/* ── Event list ── */}
      <div className="max-h-[420px] overflow-y-auto">
        {Array.from(grouped.entries()).map(([date, events], groupIdx) => (
          <div key={date}>
            {/* Day separator */}
            {groupIdx > 0 && (
              <div className="mx-6 h-px" style={{ backgroundColor: "var(--border)" }} />
            )}

            {/* Day header */}
            <div
              className="sticky top-0 px-6 py-2"
              style={{
                backgroundColor: "var(--bg-card)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                {formatDayHeader(date)}
              </p>
            </div>

            {/* Events */}
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {events.map((ev, i) => {
                const impactStyle = IMPACT_STYLES[ev.impact as "High" | "Medium"] ?? IMPACT_STYLES.Medium;
                const currencyStyle = CURRENCY_COLORS[ev.country] ?? {
                  bg: "rgba(255,255,255,0.06)",
                  border: "rgba(255,255,255,0.15)",
                  text: "var(--text-secondary)",
                };
                const time = new Date(ev.date).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Paris",
                });

                return (
                  <div
                    key={`${date}-${i}`}
                    className="flex items-start gap-3 px-6 py-3.5 transition-colors hover:bg-white/[0.02]"
                  >
                    {/* Time */}
                    <span
                      className="w-14 shrink-0 pt-0.5 text-right text-[11px] font-medium tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {time}
                    </span>

                    {/* Impact dot */}
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: impactStyle.dot }}
                    />

                    {/* Main content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Currency badge */}
                        <span
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
                          style={{
                            backgroundColor: currencyStyle.bg,
                            border: `1px solid ${currencyStyle.border}`,
                            color: currencyStyle.text,
                          }}
                        >
                          {ev.country}
                        </span>

                        {/* Impact badge */}
                        <span
                          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: impactStyle.bg,
                            border: `1px solid ${impactStyle.border}`,
                            color: impactStyle.text,
                          }}
                        >
                          {ev.impact}
                        </span>
                      </div>

                      {/* Event name */}
                      <p
                        className="mt-1 text-sm font-medium leading-snug"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {ev.title}
                      </p>

                      {/* Forecast / Previous */}
                      {(ev.forecast || ev.previous) && (
                        <div className="mt-1 flex flex-wrap gap-3">
                          {ev.forecast && (
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              Forecast:{" "}
                              <span style={{ color: "var(--text-secondary)" }}>{ev.forecast}</span>
                            </span>
                          )}
                          {ev.previous && (
                            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              Prev:{" "}
                              <span style={{ color: "var(--text-secondary)" }}>{ev.previous}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer ── */}
      <div
        className="px-6 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Source:{" "}
          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80 transition-opacity"
            style={{ color: "var(--accent-primary-light)" }}
          >
            ForexFactory
          </a>
          {" "}· High &amp; Medium impact · Major pairs only · Refreshed every hour
        </p>
      </div>
    </div>
  );
}
