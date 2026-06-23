// src/app/(app)/backtest/[id]/replay/indicators.ts
import type { Bar } from "./useReplayEngine";

export type SessionBand = {
  label: string;
  color: string;
  openTime: number;  // Unix seconds UTC
  closeTime: number; // Unix seconds UTC
};

// Returns true if the given UTC date is in US EDT (summer time)
// EDT runs from 2nd Sunday in March to 1st Sunday in November
function isUSEDT(date: Date): boolean {
  const year = date.getUTCFullYear();

  // 2nd Sunday in March
  const mar = new Date(Date.UTC(year, 2, 1));
  const marDay = mar.getUTCDay(); // 0=Sun
  const dstStart = new Date(Date.UTC(year, 2, 8 + ((7 - marDay) % 7), 7)); // 07:00 UTC = 2am ET

  // 1st Sunday in November
  const nov = new Date(Date.UTC(year, 10, 1));
  const novDay = nov.getUTCDay();
  const dstEnd = new Date(Date.UTC(year, 10, 1 + ((7 - novDay) % 7), 6)); // 06:00 UTC = 2am EDT

  return date >= dstStart && date < dstEnd;
}

// Returns NY session open/close times in UTC seconds for a given UTC calendar date (YYYY-MM-DD)
// Sessions defined in ET, converted to UTC accounting for DST
function sessionTimesUTC(dateStr: string): {
  asia: [number, number];
  london: [number, number];
  nyAm: [number, number];
  nyPm: [number, number];
} {
  const base = new Date(dateStr + "T00:00:00Z");
  const prevDay = new Date(base.getTime() - 86400 * 1000);
  const prevStr = prevDay.toISOString().slice(0, 10);

  // ET offset: EST = UTC-5, EDT = UTC-4
  const etOffsetHours = isUSEDT(base) ? 4 : 5;

  // Asia: 18:00–00:00 ET previous day → UTC
  // = (18 + etOffset):00 prev day UTC to (24 + etOffset):00 prev day UTC
  const asiaOpen = new Date(prevStr + `T${String(18 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;
  const asiaClose = new Date(dateStr + `T${String(0 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;

  // London: 02:00–05:00 UTC (fixed, not ET-based)
  const londonOpen  = new Date(dateStr + "T02:00:00Z").getTime() / 1000;
  const londonClose = new Date(dateStr + "T05:00:00Z").getTime() / 1000;

  // NY AM: 09:30–12:00 ET = (9.5 + etOffset):00–(12 + etOffset):00 UTC
  const nyAmOpen  = new Date(dateStr + `T${String(9 + etOffsetHours).padStart(2,"0")}:30:00Z`).getTime() / 1000;
  const nyAmClose = new Date(dateStr + `T${String(12 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;

  // NY PM: 13:00–16:00 ET = (13 + etOffset):00–(16 + etOffset):00 UTC
  const nyPmOpen  = new Date(dateStr + `T${String(13 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;
  const nyPmClose = new Date(dateStr + `T${String(16 + etOffsetHours).padStart(2,"0")}:00:00Z`).getTime() / 1000;

  return {
    asia:   [asiaOpen,  asiaClose],
    london: [londonOpen, londonClose],
    nyAm:   [nyAmOpen,  nyAmClose],
    nyPm:   [nyPmOpen,  nyPmClose],
  };
}

export function getSessionBands(bars: Bar[]): SessionBand[] {
  if (bars.length === 0) return [];

  const firstTime = bars[0].time;
  const lastTime  = bars[bars.length - 1].time;

  // Collect unique calendar dates (UTC) covered by bars
  const dates = new Set<string>();
  for (const bar of bars) {
    dates.add(new Date(bar.time * 1000).toISOString().slice(0, 10));
  }
  // Also include prev day for Asia session
  const allDates = new Set<string>();
  for (const d of dates) {
    allDates.add(d);
    const prev = new Date(new Date(d).getTime() - 86400 * 1000).toISOString().slice(0, 10);
    allDates.add(prev);
  }

  const bands: SessionBand[] = [];

  for (const dateStr of Array.from(allDates).sort()) {
    const { asia, london, nyAm, nyPm } = sessionTimesUTC(dateStr);

    const sessions = [
      { label: "Asia",  color: "rgba(148,163,184,0.07)", times: asia   },
      { label: "London",color: "rgba(59,130,246,0.09)",  times: london },
      { label: "NY AM", color: "rgba(34,197,94,0.09)",   times: nyAm   },
      { label: "NY PM", color: "rgba(249,115,22,0.09)",  times: nyPm   },
    ];

    for (const s of sessions) {
      const [open, close] = s.times;
      // Only include sessions that overlap with visible bars range
      if (close < firstTime || open > lastTime) continue;
      bands.push({
        label: s.label,
        color: s.color,
        openTime:  Math.max(open,  firstTime),
        closeTime: Math.min(close, lastTime),
      });
    }
  }

  return bands;
}

// IB = High/Low of bars between 09:30–10:30 ET on the last calendar day in bars
export function calcIBRange(bars: Bar[]): { high: number; low: number } | null {
  if (bars.length === 0) return null;

  // Last calendar day present in bars
  const lastDateStr = new Date(bars[bars.length - 1].time * 1000).toISOString().slice(0, 10);
  const etOffsetHours = isUSEDT(new Date(lastDateStr + "T00:00:00Z")) ? 4 : 5;

  const ibOpen  = new Date(lastDateStr + `T${String(9  + etOffsetHours).padStart(2,"0")}:30:00Z`).getTime() / 1000;
  const ibClose = new Date(lastDateStr + `T${String(10 + etOffsetHours).padStart(2,"0")}:30:00Z`).getTime() / 1000;

  const ibBars = bars.filter(b => b.time >= ibOpen && b.time < ibClose);
  if (ibBars.length === 0) return null;

  return {
    high: Math.max(...ibBars.map(b => b.high)),
    low:  Math.min(...ibBars.map(b => b.low)),
  };
}

// Returns array index-aligned with bars[]; NaN for indices before anchorIndex
export function calcVwap(bars: Bar[], anchorIndex: number): number[] {
  const result = new Array<number>(bars.length).fill(NaN);
  let cumTPV = 0; // cumulative typical_price * volume
  let cumVol = 0; // cumulative volume

  for (let i = anchorIndex; i < bars.length; i++) {
    const bar = bars[i];
    const tp = (bar.high + bar.low + bar.close) / 3;
    cumTPV += tp * bar.volume;
    cumVol += bar.volume;
    result[i] = cumVol > 0 ? cumTPV / cumVol : bar.close;
  }

  return result;
}
