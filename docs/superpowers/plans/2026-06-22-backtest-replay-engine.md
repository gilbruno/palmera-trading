# Backtest Replay Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter un moteur de replay barre-par-barre style FXReplay, intégré à la page de backtest existante, permettant de passer des ordres directement sur le graphique et de les enregistrer automatiquement comme `BacktestTrade`.

**Architecture:** Les données OHLCV M1 sont téléchargées depuis Dukascopy via `dukascopy-node` dans une table `OhlcvBar` dédiée (partagée entre backtests, déduplication par upsert). Avant tout téléchargement, on vérifie les mois déjà présents en DB (`/api/ohlcv/coverage`) pour ne télécharger que les gaps, mois par mois avec barre de progression. Le replay engine tourne 100% côté client avec `lightweight-charts` : un index `currentBarIndex` avance barre par barre, les ordres sont simulés contre les bougies futures, et chaque trade fermé est persisté via Server Action.

**Tech Stack:** `lightweight-charts` (Apache 2.0), `dukascopy-node` (MIT), Next.js Server Actions, Prisma 7, PostgreSQL (Neon)

## Global Constraints

- Next.js version: voir `package.json` (Prisma 7, adapter PrismaPg)
- Prisma client output: `src/generated/prisma`
- Auth: BetterAuth via `auth.api.getSession({ headers: await headers() })`
- Pattern Server Actions: fichiers `actions.ts` avec `"use server"`
- Pattern Server Components: pages async avec fetch direct Prisma
- CSS: variables CSS custom (`var(--bg-card)`, `var(--border)`, `var(--text-primary)`, etc.) — pas de couleurs hardcodées
- `dukascopy-node` : exécution côté serveur uniquement (Node.js)
- Instrument mapping Dukascopy: EURUSD → `eurusd`, GBPUSD → `gbpusd`, XAUUSD → `xauusd`, NQ/NQ! → `ustech`, ES/ES! → `spx500`, US100 → `ustech`
- **Pas de `git commit` dans les steps** — les commits sont faits manuellement par le développeur
- **Pas de `prisma migrate dev`** — la migration SQL est fournie et exécutée manuellement par le développeur

---

## Fichiers créés / modifiés

### Nouveaux fichiers
- `prisma/schema.prisma` — ajout modèle `OhlcvBar`
- `src/app/api/ohlcv/coverage/route.ts` — GET : mois déjà présents en DB pour un instrument/période
- `src/app/api/ohlcv/download/route.ts` — POST : télécharge 1 mois depuis Dukascopy et upsert
- `src/app/api/ohlcv/route.ts` — GET : lecture des bars pour le replay
- `src/app/(app)/backtest/[id]/replay/page.tsx` — page dédiée au replay (full-screen)
- `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx` — composant client principal
- `src/app/(app)/backtest/[id]/replay/useReplayEngine.ts` — hook state machine du replay
- `src/app/(app)/backtest/[id]/replay/OrderPanel.tsx` — panneau entry/SL/TP
- `src/app/(app)/backtest/[id]/replay/TradeResultModal.tsx` — modal post-trade + notes
- `src/app/(app)/backtest/[id]/replay/actions.ts` — Server Action `createReplayTrade`
- `src/app/(app)/backtest/[id]/OhlcvDataManager.tsx` — composant client : détection gaps + progress bar + bouton Replay

### Fichiers modifiés
- `prisma/schema.prisma` — ajout `OhlcvBar`
- `src/app/(app)/backtest/[id]/page.tsx` — ajout `<OhlcvDataManager>` dans la section actions

---

## Task 1 — Modèle OhlcvBar : schema Prisma + SQL de migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: table `ohlcv_bar` avec colonnes `(id, instrument, timeframe, timestamp, open, high, low, close, volume)`; contrainte unique `(instrument, timeframe, timestamp)`

- [ ] **Step 1: Ajouter le modèle OhlcvBar dans schema.prisma**

Ajouter après le modèle `BacktestTradeMedia` :

```prisma
// =============================================================================
// MODEL : OhlcvBar — données OHLCV partagées entre tous les backtests
// =============================================================================
model OhlcvBar {
  id         String @id @default(cuid())
  instrument String  // "EURUSD", "GBPUSD", "XAUUSD", "NQ", "ES"
  timeframe  String  // "m1", "m5", "m15", "h1"
  timestamp  BigInt  // Unix ms UTC

  open   Float
  high   Float
  low    Float
  close  Float
  volume Float @default(0)

  @@unique([instrument, timeframe, timestamp])
  @@index([instrument, timeframe, timestamp])
  @@map("ohlcv_bar")
}
```

- [ ] **Step 2: Exécuter cette migration SQL manuellement dans Neon (console SQL ou psql)**

```sql
-- Migration : add ohlcv_bar table
CREATE TABLE IF NOT EXISTS "ohlcv_bar" (
  "id"         TEXT NOT NULL,
  "instrument" TEXT NOT NULL,
  "timeframe"  TEXT NOT NULL,
  "timestamp"  BIGINT NOT NULL,
  "open"       DOUBLE PRECISION NOT NULL,
  "high"       DOUBLE PRECISION NOT NULL,
  "low"        DOUBLE PRECISION NOT NULL,
  "close"      DOUBLE PRECISION NOT NULL,
  "volume"     DOUBLE PRECISION NOT NULL DEFAULT 0,

  CONSTRAINT "ohlcv_bar_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ohlcv_bar_instrument_timeframe_timestamp_key"
  ON "ohlcv_bar"("instrument", "timeframe", "timestamp");

CREATE INDEX IF NOT EXISTS "ohlcv_bar_instrument_timeframe_timestamp_idx"
  ON "ohlcv_bar"("instrument", "timeframe", "timestamp");
```

- [ ] **Step 3: Régénérer le client Prisma**

```bash
npx prisma generate
```

Résultat attendu : `Generated Prisma Client` sans erreur.

---

## Task 2 — API route : couverture OHLCV en DB

**Files:**
- Create: `src/app/api/ohlcv/coverage/route.ts`

**Interfaces:**
- Produces: `GET /api/ohlcv/coverage?instrument=EURUSD&timeframe=m1&from=2025-01-01&to=2025-06-30`
  → `{ coveredMonths: string[], missingMonths: string[] }` où chaque entrée est `"YYYY-MM"`

- [ ] **Step 1: Créer route.ts**

```typescript
// src/app/api/ohlcv/coverage/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Génère la liste de tous les mois "YYYY-MM" entre from et to inclus
function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  const start = new Date(from);
  const end = new Date(to);
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cur <= last) {
    months.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instrument = searchParams.get("instrument");
  const timeframe = searchParams.get("timeframe") ?? "m1";
  const from = searchParams.get("from"); // "YYYY-MM-DD"
  const to = searchParams.get("to");     // "YYYY-MM-DD"

  if (!instrument || !from || !to) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const allMonths = monthsBetween(from, to);

  // Pour chaque mois, vérifier si au moins 1 bar existe en DB
  const checks = await Promise.all(
    allMonths.map(async (ym) => {
      const [year, month] = ym.split("-").map(Number);
      const monthStart = new Date(year, month - 1, 1).getTime();
      const monthEnd = new Date(year, month, 1).getTime() - 1;

      const count = await prisma.ohlcvBar.count({
        where: {
          instrument,
          timeframe,
          timestamp: { gte: BigInt(monthStart), lte: BigInt(monthEnd) },
        },
      });
      return { month: ym, covered: count > 0 };
    })
  );

  const coveredMonths = checks.filter((c) => c.covered).map((c) => c.month);
  const missingMonths = checks.filter((c) => !c.covered).map((c) => c.month);

  return NextResponse.json({ coveredMonths, missingMonths });
}
```

- [ ] **Step 2: Tester avec curl (après migration Task 1)**

```bash
curl "http://localhost:3000/api/ohlcv/coverage?instrument=EURUSD&timeframe=m1&from=2025-01-01&to=2025-03-31"
```

Résultat attendu (DB vide) :
```json
{
  "coveredMonths": [],
  "missingMonths": ["2025-01", "2025-02", "2025-03"]
}
```

---

## Task 3 — API route : téléchargement OHLCV (1 mois à la fois)

**Files:**
- Create: `src/app/api/ohlcv/download/route.ts`

**Interfaces:**
- Consumes: `dukascopy-node` npm package, `OhlcvBar` model (Task 1)
- Produces: `POST /api/ohlcv/download` body `{ instrument, month, timeframe? }` → `{ inserted: number }`
  - `month` : `"YYYY-MM"` — on télécharge exactement ce mois
- **Important** : la route télécharge **1 mois seulement** — le client appelle N fois pour N mois manquants

- [ ] **Step 1: Installer dukascopy-node**

```bash
npm install dukascopy-node
```

- [ ] **Step 2: Créer route.ts**

```typescript
// src/app/api/ohlcv/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getHistoricalRates } from "dukascopy-node";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const INSTRUMENT_MAP: Record<string, string> = {
  EURUSD: "eurusd",
  GBPUSD: "gbpusd",
  XAUUSD: "xauusd",
  NQ: "ustech",
  "NQ!": "ustech",
  ES: "spx500",
  "ES!": "spx500",
  US100: "ustech",
};

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { instrument, month, timeframe = "m1" } = body as {
    instrument: string;
    month: string;      // "YYYY-MM"
    timeframe?: string;
  };

  const dukascopyInstrument = INSTRUMENT_MAP[instrument];
  if (!dukascopyInstrument) {
    return NextResponse.json(
      { error: `Instrument non supporté: ${instrument}` },
      { status: 400 }
    );
  }

  // Calculer from/to pour ce mois exact
  const [year, mon] = month.split("-").map(Number);
  const fromDate = new Date(year, mon - 1, 1);
  const toDate = new Date(year, mon, 0, 23, 59, 59); // dernier jour du mois

  const data = await getHistoricalRates({
    instrument: dukascopyInstrument,
    dates: { from: fromDate, to: toDate },
    timeframe,
    format: "array",
    batchSize: 10,
    pauseBetweenBatchesMs: 200,
  });

  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  // Upsert par chunks de 500
  const CHUNK = 500;
  let inserted = 0;

  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((row: number[]) =>
        prisma.ohlcvBar.upsert({
          where: {
            instrument_timeframe_timestamp: {
              instrument,
              timeframe,
              timestamp: BigInt(row[0]),
            },
          },
          create: {
            instrument,
            timeframe,
            timestamp: BigInt(row[0]),
            open: row[1],
            high: row[2],
            low: row[3],
            close: row[4],
            volume: row[5] ?? 0,
          },
          update: {}, // ne rien écraser si déjà présent
        })
      )
    );
    inserted += chunk.length;
  }

  return NextResponse.json({ inserted });
}
```

- [ ] **Step 3: Tester avec curl**

```bash
curl -X POST http://localhost:3000/api/ohlcv/download \
  -H "Content-Type: application/json" \
  -d '{"instrument":"EURUSD","month":"2025-01","timeframe":"m1"}'
```

Résultat attendu : `{"inserted": N}` avec N ≈ 29000 (bars M1 de janvier 2025 Forex).

---

## Task 4 — API route : lecture des bars OHLCV

**Files:**
- Create: `src/app/api/ohlcv/route.ts`

**Interfaces:**
- Produces: `GET /api/ohlcv?instrument=EURUSD&timeframe=m1&from=<ms>&to=<ms>`
  → `Array<{ time: number, open, high, low, close, volume }>` (time en secondes UTC)

- [ ] **Step 1: Créer route.ts**

```typescript
// src/app/api/ohlcv/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instrument = searchParams.get("instrument");
  const timeframe = searchParams.get("timeframe") ?? "m1";
  const from = searchParams.get("from"); // Unix ms string
  const to = searchParams.get("to");     // Unix ms string

  if (!instrument || !from || !to) {
    return NextResponse.json(
      { error: "Missing params: instrument, from, to" },
      { status: 400 }
    );
  }

  const bars = await prisma.ohlcvBar.findMany({
    where: {
      instrument,
      timeframe,
      timestamp: { gte: BigInt(from), lte: BigInt(to) },
    },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, open: true, high: true, low: true, close: true, volume: true },
  });

  // BigInt non sérialisable — convertir en number
  // lightweight-charts attend time en secondes UTC
  const serialized = bars.map((b) => ({
    time: Number(b.timestamp) / 1000,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  return NextResponse.json(serialized);
}
```

- [ ] **Step 2: Tester avec curl (après Task 3)**

```bash
FROM=$(date -d "2025-01-06" +%s%3N)
TO=$(date -d "2025-01-07" +%s%3N)
curl "http://localhost:3000/api/ohlcv?instrument=EURUSD&timeframe=m1&from=$FROM&to=$TO"
```

Résultat attendu : tableau JSON `[{ time, open, high, low, close, volume }, ...]`.

---

## Task 5 — OhlcvDataManager : détection gaps + progress bar + bouton Replay

**Files:**
- Create: `src/app/(app)/backtest/[id]/OhlcvDataManager.tsx`

**Interfaces:**
- Consumes: `GET /api/ohlcv/coverage` (Task 2), `POST /api/ohlcv/download` (Task 3)
- Props:
  ```typescript
  {
    backtestId: string;
    instrument: string;
    periodStart: string; // "YYYY-MM-DD"
    periodEnd: string;   // "YYYY-MM-DD"
  }
  ```
- Comportement :
  1. Au montage : appelle `/api/ohlcv/coverage` pour obtenir `missingMonths`
  2. Si `missingMonths.length === 0` → affiche directement le bouton "Replay Mode"
  3. Si `missingMonths.length > 0` → affiche bouton "Download X months" avec barre de progression mois par mois
  4. Après téléchargement complet → affiche le bouton "Replay Mode"

- [ ] **Step 1: Créer OhlcvDataManager.tsx**

```typescript
// src/app/(app)/backtest/[id]/OhlcvDataManager.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Download, Play, Check, AlertCircle, Loader2 } from "lucide-react";

type Props = {
  backtestId: string;
  instrument: string;
  periodStart: string;
  periodEnd: string;
};

type CoverageState =
  | { status: "loading" }
  | { status: "ready" }                                   // toutes les data présentes
  | { status: "needs-download"; missingMonths: string[] } // gaps à télécharger
  | { status: "downloading"; missingMonths: string[]; doneCount: number }
  | { status: "done" }
  | { status: "error"; message: string };

export function OhlcvDataManager({ backtestId, instrument, periodStart, periodEnd }: Props) {
  const [state, setState] = useState<CoverageState>({ status: "loading" });

  const checkCoverage = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(
        `/api/ohlcv/coverage?instrument=${instrument}&timeframe=m1&from=${periodStart}&to=${periodEnd}`
      );
      if (!res.ok) throw new Error("Coverage check failed");
      const { missingMonths } = await res.json() as { coveredMonths: string[]; missingMonths: string[] };

      if (missingMonths.length === 0) {
        setState({ status: "ready" });
      } else {
        setState({ status: "needs-download", missingMonths });
      }
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  }, [instrument, periodStart, periodEnd]);

  useEffect(() => {
    checkCoverage();
  }, [checkCoverage]);

  async function handleDownload() {
    if (state.status !== "needs-download") return;
    const { missingMonths } = state;

    setState({ status: "downloading", missingMonths, doneCount: 0 });

    for (let i = 0; i < missingMonths.length; i++) {
      const month = missingMonths[i];
      try {
        const res = await fetch("/api/ohlcv/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrument, month, timeframe: "m1" }),
        });
        if (!res.ok) {
          const err = await res.json();
          setState({ status: "error", message: err.error ?? `Failed on ${month}` });
          return;
        }
      } catch {
        setState({ status: "error", message: `Network error on ${month}` });
        return;
      }
      setState({ status: "downloading", missingMonths, doneCount: i + 1 });
    }

    setState({ status: "done" });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <Loader2 size={13} className="animate-spin" />
        Checking data…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm" style={{ color: "#ef4444" }}>
          <AlertCircle size={13} /> {state.message}
        </span>
        <button
          onClick={checkCoverage}
          className="rounded-lg px-2 py-1 text-xs"
          style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.status === "ready" || state.status === "done") {
    return (
      <Link
        href={`/backtest/${backtestId}/replay`}
        className="flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-bold"
        style={{ backgroundColor: "#6366f1", color: "#fff" }}
      >
        <Play size={13} /> Replay Mode
      </Link>
    );
  }

  if (state.status === "needs-download") {
    const { missingMonths } = state;
    return (
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold"
        style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
      >
        <Download size={13} />
        Download {missingMonths.length} month{missingMonths.length > 1 ? "s" : ""} to enable Replay
      </button>
    );
  }

  // status === "downloading"
  if (state.status === "downloading") {
    const { missingMonths, doneCount } = state;
    const total = missingMonths.length;
    const pct = Math.round((doneCount / total) * 100);
    const currentMonth = missingMonths[doneCount] ?? missingMonths[total - 1];

    return (
      <div className="flex flex-col gap-1.5 min-w-[220px]">
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" />
            {currentMonth}…
          </span>
          <span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>
            {doneCount}/{total} ({pct}%)
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: "#6366f1" }}
          />
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
          {missingMonths.slice(0, doneCount).map((m) => (
            <span key={m} className="flex items-center gap-0.5" style={{ color: "#22c55e" }}>
              <Check size={10} /> {m}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Modifier `src/app/(app)/backtest/[id]/page.tsx`**

Ajouter l'import en haut du fichier :
```typescript
import { OhlcvDataManager } from "./OhlcvDataManager";
```

Dans la section `{/* Actions */}` (ligne ~106), ajouter **avant** `<DeleteButton>` :
```tsx
<OhlcvDataManager
  backtestId={id}
  instrument={backtest.instrument}
  periodStart={backtest.periodStart.toISOString().slice(0, 10)}
  periodEnd={backtest.periodEnd.toISOString().slice(0, 10)}
/>
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Résultat attendu : 0 erreurs.

---

## Task 6 — Hook useReplayEngine (state machine du replay)

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/useReplayEngine.ts`

**Interfaces:**
- Produces: hook `useReplayEngine(bars, opts)` et types `Bar`, `PendingOrder`, `FilledTrade`
  ```typescript
  {
    visibleBars: Bar[];
    currentIndex: number;
    currentBar: Bar | null;
    isPlaying: boolean;
    speed: number;              // 1 | 2 | 5 | 10
    pendingOrder: PendingOrder | null;
    play: () => void;
    pause: () => void;
    stepForward: () => void;
    stepBackward: () => void;
    jumpTo: (index: number) => void;
    setSpeed: (s: number) => void;
    placeOrder: (order: PendingOrder) => void;
    cancelOrder: () => void;
  }
  ```

- [ ] **Step 1: Créer useReplayEngine.ts**

```typescript
// src/app/(app)/backtest/[id]/replay/useReplayEngine.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type Bar = {
  time: number;   // Unix secondes UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PendingOrder = {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryBarIndex: number;
};

export type FilledTrade = {
  order: PendingOrder;
  entryBar: Bar;
  exitBar: Bar;
  exitPrice: number;
  outcome: "WIN" | "LOSS";
  rMultiple: number;
  pnlPoints: number;
};

type UseReplayEngineOpts = {
  onTradeFilled: (trade: FilledTrade) => void;
};

const MIN_START_INDEX = 50; // bougies visibles au démarrage

export function useReplayEngine(bars: Bar[], { onTradeFilled }: UseReplayEngineOpts) {
  const [currentIndex, setCurrentIndex] = useState(MIN_START_INDEX);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOrderRef = useRef<PendingOrder | null>(null);
  pendingOrderRef.current = pendingOrder;

  const visibleBars = bars.slice(0, currentIndex + 1);
  const currentBar = bars[currentIndex] ?? null;

  const checkOrderFill = useCallback(
    (bar: Bar) => {
      const order = pendingOrderRef.current;
      if (!order) return;

      const { direction, entryPrice, stopLoss, takeProfit } = order;
      let exitPrice: number | null = null;
      let outcome: "WIN" | "LOSS" | null = null;

      if (direction === "LONG") {
        if (bar.low <= stopLoss)       { exitPrice = stopLoss;   outcome = "LOSS"; }
        else if (bar.high >= takeProfit) { exitPrice = takeProfit; outcome = "WIN";  }
      } else {
        if (bar.high >= stopLoss)      { exitPrice = stopLoss;   outcome = "LOSS"; }
        else if (bar.low <= takeProfit)  { exitPrice = takeProfit; outcome = "WIN";  }
      }

      if (exitPrice === null || outcome === null) return;

      const risk = Math.abs(entryPrice - stopLoss);
      const rMultiple =
        direction === "LONG"
          ? (exitPrice - entryPrice) / risk
          : (entryPrice - exitPrice) / risk;
      const pnlPoints =
        direction === "LONG"
          ? exitPrice - entryPrice
          : entryPrice - exitPrice;

      const filled: FilledTrade = {
        order,
        entryBar: bars[order.entryBarIndex],
        exitBar: bar,
        exitPrice,
        outcome,
        rMultiple: Math.round(rMultiple * 100) / 100,
        pnlPoints: Math.round(pnlPoints * 10000) / 10000,
      };

      setPendingOrder(null);
      onTradeFilled(filled);
    },
    [bars, onTradeFilled]
  );

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, bars.length - 1);
      if (next !== prev) checkOrderFill(bars[next]);
      return next;
    });
  }, [bars, checkOrderFill]);

  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, MIN_START_INDEX));
    setPendingOrder(null);
  }, []);

  const jumpTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(MIN_START_INDEX, Math.min(index, bars.length - 1)));
      setPendingOrder(null);
    },
    [bars.length]
  );

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const placeOrder = useCallback((order: PendingOrder) => setPendingOrder(order), []);
  const cancelOrder = useCallback(() => setPendingOrder(null), []);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(stepForward, Math.round(1000 / speed));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, stepForward]);

  return {
    visibleBars,
    currentIndex,
    currentBar,
    isPlaying,
    speed,
    pendingOrder,
    play,
    pause,
    stepForward,
    stepBackward,
    jumpTo,
    setSpeed,
    placeOrder,
    cancelOrder,
  };
}
```

---

## Task 7 — OrderPanel : panneau de saisie entry/SL/TP

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/OrderPanel.tsx`

**Interfaces:**
- Consumes: `PendingOrder` (Task 6)
- Props: `{ currentPrice: number; currentBarIndex: number; onConfirm: (order: PendingOrder) => void; onCancel: () => void }`

- [ ] **Step 1: Créer OrderPanel.tsx**

```typescript
// src/app/(app)/backtest/[id]/replay/OrderPanel.tsx
"use client";

import { useState } from "react";
import type { PendingOrder } from "./useReplayEngine";

type Props = {
  currentPrice: number;
  currentBarIndex: number;
  onConfirm: (order: PendingOrder) => void;
  onCancel: () => void;
};

export function OrderPanel({ currentPrice, currentBarIndex, onConfirm, onCancel }: Props) {
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [entryPrice, setEntryPrice] = useState(currentPrice.toFixed(5));
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ep = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    if (isNaN(ep) || isNaN(sl) || isNaN(tp)) return;
    onConfirm({ direction, entryPrice: ep, stopLoss: sl, takeProfit: tp, entryBarIndex: currentBarIndex });
  }

  return (
    <div
      className="absolute bottom-24 right-4 z-20 w-72 rounded-2xl p-4 shadow-2xl"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        Place Order
      </p>

      <div className="mb-3 flex gap-2">
        {(["LONG", "SHORT"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className="flex-1 rounded-xl py-2 text-sm font-bold transition-all"
            style={{
              backgroundColor: direction === d ? (d === "LONG" ? "#22c55e" : "#ef4444") : "var(--bg-surface)",
              color: direction === d ? "#fff" : "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
          >
            {d === "LONG" ? "LONG ▲" : "SHORT ▼"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {[
          { label: "Entry", value: entryPrice, onChange: setEntryPrice, placeholder: "" },
          { label: "Stop Loss", value: stopLoss, onChange: setStopLoss, placeholder: direction === "LONG" ? "< entry" : "> entry" },
          { label: "Take Profit", value: takeProfit, onChange: setTakeProfit, placeholder: direction === "LONG" ? "> entry" : "< entry" },
        ].map(({ label, value, onChange, placeholder }) => (
          <div key={label}>
            <label className="mb-0.5 block text-xs" style={{ color: "var(--text-muted)" }}>{label}</label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        ))}

        <div className="mt-2 flex gap-2">
          <button
            type="submit"
            className="flex-1 rounded-xl py-2 text-sm font-bold"
            style={{ backgroundColor: direction === "LONG" ? "#22c55e" : "#ef4444", color: "#fff" }}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl py-2 text-sm font-bold"
            style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## Task 8 — TradeResultModal : modal post-trade avec notes

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/TradeResultModal.tsx`

**Interfaces:**
- Consumes: `FilledTrade` (Task 6)
- Props: `{ trade: FilledTrade; onSave: (notes: string) => void; onDiscard: () => void; isSaving: boolean }`

- [ ] **Step 1: Créer TradeResultModal.tsx**

```typescript
// src/app/(app)/backtest/[id]/replay/TradeResultModal.tsx
"use client";

import { useState } from "react";
import type { FilledTrade } from "./useReplayEngine";

type Props = {
  trade: FilledTrade;
  onSave: (notes: string) => void;
  onDiscard: () => void;
  isSaving: boolean;
};

export function TradeResultModal({ trade, onSave, onDiscard, isSaving }: Props) {
  const [notes, setNotes] = useState("");

  const isWin = trade.outcome === "WIN";
  const outcomeColor = isWin ? "#22c55e" : "#ef4444";

  const fmt = (ts: number) =>
    new Date(ts * 1000).toUTCString().slice(0, 22);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Trade {trade.outcome}
          </h2>
          <span className="text-2xl font-black" style={{ color: outcomeColor }}>
            {trade.rMultiple > 0 ? "+" : ""}{trade.rMultiple}R
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          {([
            ["Direction", trade.order.direction],
            ["Entry",     trade.order.entryPrice.toFixed(5)],
            ["Exit",      trade.exitPrice.toFixed(5)],
            ["SL",        trade.order.stopLoss.toFixed(5)],
            ["TP",        trade.order.takeProfit.toFixed(5)],
            ["P&L pts",   (trade.pnlPoints > 0 ? "+" : "") + trade.pnlPoints.toFixed(4)],
            ["Entry date", fmt(trade.entryBar.time)],
            ["Exit date",  fmt(trade.exitBar.time)],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Notes (optionnel — PD Array HTF, structure…)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl px-3 py-2 text-sm"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            placeholder="ex: OB H4 respecté, FVG H1 comblé, Silver Bullet 10h…"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onSave(notes)}
            disabled={isSaving}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}
          >
            {isSaving ? "Saving…" : "Save Trade"}
          </button>
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Task 9 — Server Action createReplayTrade

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/actions.ts`

**Interfaces:**
- Consumes: `FilledTrade` (Task 6), `prisma.backtestTrade.create`
- Produces: `createReplayTrade(backtestId: string, trade: FilledTrade, notes: string) => Promise<string>`

- [ ] **Step 1: Créer actions.ts**

```typescript
// src/app/(app)/backtest/[id]/replay/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { FilledTrade } from "./useReplayEngine";

export async function createReplayTrade(
  backtestId: string,
  trade: FilledTrade,
  notes: string
): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const backtest = await prisma.backtest.findFirst({
    where: { id: backtestId, userId: session.user.id },
    select: { id: true },
  });
  if (!backtest) throw new Error("Backtest not found.");

  const count = await prisma.backtestTrade.count({ where: { backtestId } });

  const created = await prisma.backtestTrade.create({
    data: {
      backtestId,
      tradeNumber:  count + 1,
      direction:    trade.order.direction,
      outcome:      trade.outcome,
      entryDate:    new Date(trade.entryBar.time * 1000),
      exitDate:     new Date(trade.exitBar.time * 1000),
      entryPrice:   trade.order.entryPrice,
      exitPrice:    trade.exitPrice,
      stopLoss:     trade.order.stopLoss,
      takeProfit:   trade.order.takeProfit,
      rMultiple:    trade.rMultiple,
      pnlPoints:    trade.pnlPoints,
      notes:        notes.trim() || null,
    },
    select: { id: true },
  });

  revalidatePath(`/backtest/${backtestId}`);
  return created.id;
}
```

---

## Task 10 — ReplayEngine : composant chart principal

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Interfaces:**
- Consumes: `useReplayEngine` (Task 6), `OrderPanel` (Task 7), `TradeResultModal` (Task 8), `createReplayTrade` (Task 9), `lightweight-charts`
- Props: `{ backtestId: string; instrument: string; initialBars: Bar[] }`

- [ ] **Step 1: Installer lightweight-charts**

```bash
npm install lightweight-charts
```

- [ ] **Step 2: Créer ReplayEngine.tsx**

```typescript
// src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  ColorType,
} from "lightweight-charts";
import { useReplayEngine, type Bar, type FilledTrade } from "./useReplayEngine";
import { OrderPanel } from "./OrderPanel";
import { TradeResultModal } from "./TradeResultModal";
import { createReplayTrade } from "./actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  backtestId: string;
  instrument: string;
  initialBars: Bar[];
};

export function ReplayEngine({ backtestId, instrument, initialBars }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [pendingTrade, setPendingTrade] = useState<FilledTrade | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleTradeFilled = useCallback((trade: FilledTrade) => {
    setPendingTrade(trade);
  }, []);

  const engine = useReplayEngine(initialBars, { onTradeFilled: handleTradeFilled });

  // Init chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0f1117" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      crosshair: { mode: 1 },
      width:  chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const series = chart.addCandlestickSeries({
      upColor:        "#22c55e",
      downColor:      "#ef4444",
      borderUpColor:  "#22c55e",
      borderDownColor:"#ef4444",
      wickUpColor:    "#22c55e",
      wickDownColor:  "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width:  chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    ro.observe(chartContainerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  // Mettre à jour le chart à chaque nouvelle bougie
  useEffect(() => {
    if (!seriesRef.current) return;
    const data: CandlestickData[] = engine.visibleBars.map((b) => ({
      time:  b.time as number,
      open:  b.open,
      high:  b.high,
      low:   b.low,
      close: b.close,
    }));
    seriesRef.current.setData(data);
    if (chartRef.current && data.length > 0) {
      chartRef.current.timeScale().scrollToPosition(5, false);
    }
  }, [engine.visibleBars]);

  async function handleSaveTrade(notes: string) {
    if (!pendingTrade) return;
    setIsSaving(true);
    try {
      await createReplayTrade(backtestId, pendingTrade, notes);
      setPendingTrade(null);
    } finally {
      setIsSaving(false);
    }
  }

  const currentPrice = engine.currentBar?.close ?? 0;

  return (
    <div className="relative flex h-screen w-full flex-col" style={{ backgroundColor: "#0f1117" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid #1f2937" }}>
        <Link
          href={`/backtest/${backtestId}`}
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
        >
          <ArrowLeft size={14} />
        </Link>

        <span className="text-sm font-bold" style={{ color: "#a5b4fc" }}>{instrument}</span>
        <span className="text-sm" style={{ color: "#6b7280" }}>
          {engine.currentBar
            ? new Date(engine.currentBar.time * 1000).toUTCString().slice(0, 22)
            : "—"}
        </span>
        <span className="font-mono text-sm" style={{ color: "#f9fafb" }}>
          {currentPrice.toFixed(5)}
        </span>

        <div className="ml-auto flex items-center gap-3">
          {/* Speed */}
          <div className="flex gap-1">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => engine.setSpeed(s)}
                className="rounded-lg px-2 py-1 text-xs font-bold"
                style={{
                  backgroundColor: engine.speed === s ? "#6366f1" : "#1f2937",
                  color: engine.speed === s ? "#fff" : "#9ca3af",
                }}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Playback */}
          <div className="flex gap-1">
            <button
              onClick={engine.stepBackward}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
              title="← 1 bougie"
            >◀</button>
            <button
              onClick={engine.isPlaying ? engine.pause : engine.play}
              className="rounded-lg px-4 py-1.5 text-sm font-bold"
              style={{ backgroundColor: engine.isPlaying ? "#ef4444" : "#22c55e", color: "#fff" }}
            >
              {engine.isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={engine.stepForward}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
              title="1 bougie →"
            >▶</button>
          </div>

          {/* Order */}
          <button
            onClick={() => { engine.pause(); setShowOrderPanel(true); }}
            disabled={!!engine.pendingOrder}
            className="rounded-xl px-4 py-1.5 text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}
          >
            {engine.pendingOrder ? "Order Active" : "+ Order"}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="flex-1" />

      {/* Order panel */}
      {showOrderPanel && !engine.pendingOrder && (
        <OrderPanel
          currentPrice={currentPrice}
          currentBarIndex={engine.currentIndex}
          onConfirm={(order) => {
            engine.placeOrder(order);
            setShowOrderPanel(false);
            engine.play();
          }}
          onCancel={() => setShowOrderPanel(false)}
        />
      )}

      {/* Trade result modal */}
      {pendingTrade && (
        <TradeResultModal
          trade={pendingTrade}
          onSave={handleSaveTrade}
          onDiscard={() => setPendingTrade(null)}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
```

---

## Task 11 — Page replay

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/page.tsx`

**Interfaces:**
- Consumes: `ReplayEngine` (Task 10), `OhlcvBar` via Prisma, `Backtest` via Prisma
- Produces: page server `/backtest/[id]/replay` avec formulaire de sélection de période

- [ ] **Step 1: Créer page.tsx**

```typescript
// src/app/(app)/backtest/[id]/replay/page.tsx
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ReplayEngine } from "./ReplayEngine";
import type { Bar } from "./useReplayEngine";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; tf?: string }>;
};

export default async function ReplayPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from, to, tf = "m1" } = await searchParams;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const backtest = await prisma.backtest.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, instrument: true, periodStart: true, periodEnd: true, name: true },
  });
  if (!backtest) notFound();

  if (!from || !to) {
    return (
      <PeriodSelector
        backtestId={id}
        instrument={backtest.instrument}
        defaultFrom={backtest.periodStart.toISOString().slice(0, 10)}
        defaultTo={backtest.periodEnd.toISOString().slice(0, 10)}
      />
    );
  }

  const fromMs = new Date(from).getTime();
  const toMs   = new Date(to).getTime();

  const rawBars = await prisma.ohlcvBar.findMany({
    where: {
      instrument: backtest.instrument,
      timeframe: tf,
      timestamp: { gte: BigInt(fromMs), lte: BigInt(toMs) },
    },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, open: true, high: true, low: true, close: true, volume: true },
  });

  if (rawBars.length === 0) {
    return (
      <NoDataScreen
        backtestId={id}
        instrument={backtest.instrument}
        from={from}
        to={to}
        timeframe={tf}
      />
    );
  }

  const bars: Bar[] = rawBars.map((b) => ({
    time:   Number(b.timestamp) / 1000,
    open:   b.open,
    high:   b.high,
    low:    b.low,
    close:  b.close,
    volume: b.volume,
  }));

  return <ReplayEngine backtestId={id} instrument={backtest.instrument} initialBars={bars} />;
}

function PeriodSelector({ backtestId, instrument, defaultFrom, defaultTo }: {
  backtestId: string; instrument: string; defaultFrom: string; defaultTo: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#0f1117" }}>
      <div className="w-full max-w-md rounded-2xl p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <Link href={`/backtest/${backtestId}`} className="mb-6 flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft size={14} /> Back to backtest
        </Link>
        <h1 className="mb-1 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Replay Mode</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--text-muted)" }}>{instrument}</p>

        <form method="GET" className="flex flex-col gap-4">
          {[
            { name: "from", label: "From", defaultValue: defaultFrom },
            { name: "to",   label: "To",   defaultValue: defaultTo   },
          ].map(({ name, label, defaultValue }) => (
            <div key={name}>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{label}</label>
              <input type="date" name={name} defaultValue={defaultValue} className="w-full rounded-xl px-3 py-2 text-sm"
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Timeframe</label>
            <select name="tf" defaultValue="m1" className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="m1">M1</option>
              <option value="m5">M5</option>
              <option value="m15">M15</option>
              <option value="h1">H1</option>
            </select>
          </div>
          <button type="submit" className="mt-2 w-full rounded-xl py-3 text-sm font-bold"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}>
            Load Replay
          </button>
        </form>
      </div>
    </div>
  );
}

function NoDataScreen({ backtestId, instrument, from, to, timeframe }: {
  backtestId: string; instrument: string; from: string; to: string; timeframe: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4" style={{ backgroundColor: "#0f1117" }}>
      <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>No OHLCV data found</p>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>{instrument} · {timeframe.toUpperCase()} · {from} → {to}</p>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Download data first from the backtest page.</p>
      <Link href={`/backtest/${backtestId}`} className="mt-2 rounded-xl px-6 py-2.5 text-sm font-bold"
        style={{ backgroundColor: "#6366f1", color: "#fff" }}>
        Back to Backtest
      </Link>
    </div>
  );
}
```

---

## Task 12 — Test end-to-end

**Files:** aucun — test manuel

- [ ] **Step 1: Démarrer l'app**

```bash
npm run dev
```

- [ ] **Step 2: Vérifier la couverture (DB vide)**

Aller sur `/backtest/<id>`. Le composant `OhlcvDataManager` doit afficher :
`"Download X months to enable Replay"` (bouton gris avec le nombre de mois manquants).

- [ ] **Step 3: Télécharger 1 mois**

Cliquer le bouton Download. Observer la barre de progression mois par mois.
Après completion → le bouton "Replay Mode" (violet) doit apparaître.

- [ ] **Step 4: Vérifier deduplication**

Recharger la page. Le composant doit directement afficher "Replay Mode" sans proposer de Download (les mois sont couverts).

- [ ] **Step 5: Tester le replay**

Cliquer "Replay Mode" → sélectionner une période → "Load Replay".
- Chart s'affiche avec 50 bougies initiales
- ▶ Play avance les bougies à 1/seconde
- Changer vitesse → immédiat
- ◀ Reculer → supprime l'ordre pending si actif

- [ ] **Step 6: Tester un trade complet**

1. Pause → "+ Order" → LONG → entry/SL/TP → Confirm → Play
2. Attendre que SL ou TP soit touché → modal `TradeResultModal` s'affiche
3. Entrer une note → "Save Trade"
4. Aller sur `/backtest/<id>` → le `BacktestTrade` apparaît dans la liste

---

## Notes d'implémentation

**BigInt Prisma :** `timestamp` est `BigInt`. Ne jamais passer un `BigInt` à un composant client — toujours convertir avec `Number(b.timestamp)` côté server component avant de sérialiser.

**lightweight-charts time :** attend des secondes UTC entières (`timestamp_ms / 1000`), pas des millisecondes.

**Performance à 10x :** `setData()` sur 50k bougies peut laguer. Optimisation future : utiliser `series.update(lastBar)` au lieu de `setData(allBars)` pour n'ajouter que la dernière bougie. Implémentable en exposant `lastBar` depuis `useReplayEngine`.

**Timeout Vercel Free :** chaque appel `/api/ohlcv/download` télécharge 1 mois (~50s max). Le découpage mois par mois depuis le client évite le timeout de 30s de Vercel Free.

**Instruments Dukascopy :** `ustech` = NQ CFD, `spx500` = ES CFD. Les Futures CME réels (`NQ!`, `ES!`) ne sont probablement pas disponibles — les CFD suivent le même prix avec un écart minimal.
