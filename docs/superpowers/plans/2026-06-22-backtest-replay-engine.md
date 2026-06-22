# Backtest Replay Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter un moteur de replay barre-par-barre style FXReplay, intégré à la page de backtest existante, permettant de passer des ordres directement sur le graphique et de les enregistrer automatiquement comme `BacktestTrade`.

**Architecture:** Les données OHLCV M1 sont téléchargées depuis Dukascopy via `dukascopy-node` dans une table `OhlcvBar` dédiée (partagée entre backtests). Le replay engine tourne 100% côté client avec `lightweight-charts` : un index `currentBarIndex` avance barre par barre, les ordres sont simulés contre les bougies futures, et chaque trade fermé est persisté via l'action `addBacktestTrade` existante. Le replay est accessible depuis un nouveau bouton "Replay Mode" sur la page `/backtest/[id]`.

**Tech Stack:** `lightweight-charts` (Apache 2.0), `dukascopy-node` (MIT), Next.js Server Actions, Prisma 7, PostgreSQL (Neon)

## Global Constraints

- Next.js version: voir `package.json` (Prisma 7, adapter PrismaPg)
- Prisma client output: `src/generated/prisma`
- Auth: BetterAuth via `auth.api.getSession({ headers: await headers() })`
- Pattern Server Actions: fichiers `actions.ts` avec `"use server"` — pas de route API séparée
- Pattern Server Components: pages async avec fetch direct Prisma
- CSS: variables CSS custom (`var(--bg-card)`, `var(--border)`, `var(--text-primary)`, etc.) — pas de couleurs hardcodées
- `dukascopy-node` : exécution côté serveur uniquement (Node.js)
- Instrument mapping Dukascopy: EURUSD → `eurusd`, GBPUSD → `gbpusd`, XAUUSD → `xauusd`, NQ (CFD) → `ustech`, ES (CFD) → `spx500` — les Futures `NQ!`/`ES!` CME utilisent `nq` / `es` (vérifier disponibilité)

---

## Fichiers créés / modifiés

### Nouveaux fichiers
- `prisma/schema.prisma` — ajout modèle `OhlcvBar`
- `prisma/migrations/` — migration auto-générée
- `src/app/api/ohlcv/route.ts` — API route GET pour fetcher les bars d'un instrument/période (utilisée par le client replay)
- `src/app/api/ohlcv/download/route.ts` — API route POST pour déclencher le téléchargement Dukascopy côté serveur
- `src/app/(app)/backtest/[id]/replay/page.tsx` — page dédiée au replay (full-screen)
- `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx` — composant client principal (chart + contrôles)
- `src/app/(app)/backtest/[id]/replay/useReplayEngine.ts` — hook gérant l'état du replay (index, vitesse, ordres en cours)
- `src/app/(app)/backtest/[id]/replay/OrderPanel.tsx` — panneau flottant entry/SL/TP affiché après click sur le chart
- `src/app/(app)/backtest/[id]/replay/TradeResultModal.tsx` — modal post-trade (résultat + champ notes)
- `src/app/(app)/backtest/[id]/replay/actions.ts` — Server Action `createReplayTrade` (wrapper de `addBacktestTrade`)

### Fichiers modifiés
- `prisma/schema.prisma` — ajout `OhlcvBar`
- `src/app/(app)/backtest/[id]/page.tsx` — ajout bouton "Replay Mode" → lien vers `/backtest/[id]/replay`

---

## Task 1 — Modèle OhlcvBar + migration Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Run: `npx prisma migrate dev`

**Interfaces:**
- Produces: table `ohlcv_bar` avec colonnes `(id, instrument, timeframe, timestamp, open, high, low, close, volume)`; index unique `(instrument, timeframe, timestamp)`

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

  open  Float
  high  Float
  low   Float
  close Float
  volume Float @default(0)

  @@unique([instrument, timeframe, timestamp])
  @@index([instrument, timeframe, timestamp])
  @@map("ohlcv_bar")
}
```

- [ ] **Step 2: Générer et appliquer la migration**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npx prisma migrate dev --name add_ohlcv_bar
```

Résultat attendu : `Your database is now in sync with your schema.`

- [ ] **Step 3: Vérifier la génération du client**

```bash
npx prisma generate
```

Résultat attendu : `Generated Prisma Client` sans erreur.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add OhlcvBar model for replay engine data storage"
```

---

## Task 2 — API route : téléchargement OHLCV depuis Dukascopy

**Files:**
- Create: `src/app/api/ohlcv/download/route.ts`

**Interfaces:**
- Consumes: `OhlcvBar` model (Task 1), `dukascopy-node` npm package
- Produces: `POST /api/ohlcv/download` → `{ inserted: number, skipped: number }`
- Request body: `{ instrument: string, from: string, to: string, timeframe?: string }`

- [ ] **Step 1: Installer dukascopy-node**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npm install dukascopy-node
```

Résultat attendu : package ajouté dans `node_modules`, `package.json` mis à jour.

- [ ] **Step 2: Créer le fichier route.ts**

```typescript
// src/app/api/ohlcv/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getHistoricalRates } from "dukascopy-node";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Map nos noms d'instruments → identifiants Dukascopy
const INSTRUMENT_MAP: Record<string, string> = {
  EURUSD: "eurusd",
  GBPUSD: "gbpusd",
  XAUUSD: "xauusd",
  NQ: "ustech",     // NQ CFD
  ES: "spx500",     // ES CFD
  "NQ!": "ustech",
  "ES!": "spx500",
  US100: "ustech",
};

const TIMEFRAME_MAP: Record<string, string> = {
  m1: "m1",
  m5: "m5",
  m15: "m15",
  h1: "h1",
};

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { instrument, from, to, timeframe = "m1" } = body as {
    instrument: string;
    from: string;   // "YYYY-MM-DD"
    to: string;     // "YYYY-MM-DD"
    timeframe?: string;
  };

  const dukascopyInstrument = INSTRUMENT_MAP[instrument];
  if (!dukascopyInstrument) {
    return NextResponse.json({ error: `Instrument non supporté: ${instrument}` }, { status: 400 });
  }

  const dukascopyTf = TIMEFRAME_MAP[timeframe] ?? "m1";

  const fromDate = new Date(from);
  const toDate = new Date(to);

  const data = await getHistoricalRates({
    instrument: dukascopyInstrument,
    dates: { from: fromDate, to: toDate },
    timeframe: dukascopyTf,
    format: "array",
    batchSize: 10,
    pauseBetweenBatchesMs: 200,
  });

  // data = [[timestamp, open, high, low, close, volume], ...]
  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0 });
  }

  let inserted = 0;
  let skipped = 0;

  // Upsert par chunks de 500 pour éviter les timeouts
  const CHUNK = 500;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    const result = await prisma.$transaction(
      chunk.map((row: number[]) =>
        prisma.ohlcvBar.upsert({
          where: {
            instrument_timeframe_timestamp: {
              instrument,
              timeframe: dukascopyTf,
              timestamp: BigInt(row[0]),
            },
          },
          create: {
            instrument,
            timeframe: dukascopyTf,
            timestamp: BigInt(row[0]),
            open: row[1],
            high: row[2],
            low: row[3],
            close: row[4],
            volume: row[5] ?? 0,
          },
          update: {},  // Ne pas écraser si déjà présent
        })
      )
    );
    inserted += result.length;
  }

  return NextResponse.json({ inserted, skipped });
}
```

- [ ] **Step 3: Tester manuellement avec curl**

```bash
curl -X POST http://localhost:3000/api/ohlcv/download \
  -H "Content-Type: application/json" \
  -d '{"instrument":"EURUSD","from":"2025-01-06","to":"2025-01-10","timeframe":"m1"}'
```

Résultat attendu : `{"inserted": <N>, "skipped": 0}` avec N > 0 (environ 2400 bars pour 4 jours de Forex M1).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ohlcv/download/route.ts package.json package-lock.json
git commit -m "feat: API route to download OHLCV from Dukascopy and upsert into OhlcvBar"
```

---

## Task 3 — API route : lecture des bars OHLCV

**Files:**
- Create: `src/app/api/ohlcv/route.ts`

**Interfaces:**
- Consumes: `OhlcvBar` model (Task 1)
- Produces: `GET /api/ohlcv?instrument=EURUSD&timeframe=m1&from=<ms>&to=<ms>` → `OhlcvBar[]` sérialisé (timestamps en string car BigInt)

- [ ] **Step 1: Créer la route GET**

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
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!instrument || !from || !to) {
    return NextResponse.json({ error: "Missing params: instrument, from, to" }, { status: 400 });
  }

  const bars = await prisma.ohlcvBar.findMany({
    where: {
      instrument,
      timeframe,
      timestamp: {
        gte: BigInt(from),
        lte: BigInt(to),
      },
    },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      open: true,
      high: true,
      low: true,
      close: true,
      volume: true,
    },
  });

  // BigInt n'est pas sérialisable en JSON natif — convertir en string
  const serialized = bars.map((b) => ({
    time: Number(b.timestamp) / 1000, // lightweight-charts attend des secondes UTC
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  return NextResponse.json(serialized);
}
```

- [ ] **Step 2: Tester avec curl (après Task 2 exécutée)**

```bash
FROM=$(date -d "2025-01-06" +%s%3N)
TO=$(date -d "2025-01-07" +%s%3N)
curl "http://localhost:3000/api/ohlcv?instrument=EURUSD&timeframe=m1&from=$FROM&to=$TO"
```

Résultat attendu : tableau JSON de barres OHLCV avec champs `time, open, high, low, close, volume`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ohlcv/route.ts
git commit -m "feat: API route GET /api/ohlcv to read OHLCV bars for replay"
```

---

## Task 4 — Hook useReplayEngine (state machine du replay)

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/useReplayEngine.ts`

**Interfaces:**
- Consumes: `OhlcvBar` serialisé `{ time: number, open, high, low, close, volume }[]`
- Produces: hook `useReplayEngine(bars, opts)` retournant:
  ```typescript
  {
    visibleBars: Bar[];         // bougies révélées jusqu'à currentIndex
    currentIndex: number;
    currentBar: Bar | null;     // bougie courante
    isPlaying: boolean;
    speed: number;              // 1 | 2 | 5 | 10 (bougies/seconde)
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

- [ ] **Step 1: Définir les types et créer le hook**

```typescript
// src/app/(app)/backtest/[id]/replay/useReplayEngine.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type Bar = {
  time: number;   // Unix secondes
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
  outcome: "WIN" | "LOSS" | "BREAKEVEN";
  rMultiple: number;
  pnlPoints: number;
};

type UseReplayEngineOpts = {
  onTradeFilled: (trade: FilledTrade) => void;
};

export function useReplayEngine(
  bars: Bar[],
  { onTradeFilled }: UseReplayEngineOpts
) {
  const [currentIndex, setCurrentIndex] = useState(50); // démarre avec 50 bougies visibles
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOrderRef = useRef<PendingOrder | null>(null);
  pendingOrderRef.current = pendingOrder;

  const visibleBars = bars.slice(0, currentIndex + 1);
  const currentBar = bars[currentIndex] ?? null;

  // Vérifie si un ordre pending est déclenché par la bougie `bar`
  const checkOrderFill = useCallback(
    (bar: Bar, idx: number) => {
      const order = pendingOrderRef.current;
      if (!order) return;

      const { direction, entryPrice, stopLoss, takeProfit } = order;

      let exitPrice: number | null = null;
      let outcome: "WIN" | "LOSS" | "BREAKEVEN" | null = null;

      if (direction === "LONG") {
        if (bar.low <= stopLoss) {
          exitPrice = stopLoss;
          outcome = "LOSS";
        } else if (bar.high >= takeProfit) {
          exitPrice = takeProfit;
          outcome = "WIN";
        }
      } else {
        if (bar.high >= stopLoss) {
          exitPrice = stopLoss;
          outcome = "LOSS";
        } else if (bar.low <= takeProfit) {
          exitPrice = takeProfit;
          outcome = "WIN";
        }
      }

      if (exitPrice !== null && outcome !== null) {
        const risk = Math.abs(entryPrice - stopLoss);
        const reward = exitPrice - entryPrice;
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
      }
    },
    [bars, onTradeFilled]
  );

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = Math.min(prev + 1, bars.length - 1);
      if (next !== prev) {
        checkOrderFill(bars[next], next);
      }
      return next;
    });
  }, [bars, checkOrderFill]);

  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 50));
    setPendingOrder(null);
  }, []);

  const jumpTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(50, Math.min(index, bars.length - 1)));
    setPendingOrder(null);
  }, [bars.length]);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const placeOrder = useCallback((order: PendingOrder) => {
    setPendingOrder(order);
  }, []);

  const cancelOrder = useCallback(() => {
    setPendingOrder(null);
  }, []);

  // Autoplay loop
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const ms = Math.round(1000 / speed);
    intervalRef.current = setInterval(stepForward, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/backtest/[id]/replay/useReplayEngine.ts
git commit -m "feat: useReplayEngine hook — state machine for bar-by-bar replay with order simulation"
```

---

## Task 5 — OrderPanel : panneau de saisie entry/SL/TP

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/OrderPanel.tsx`

**Interfaces:**
- Consumes: `PendingOrder` type (Task 4), `currentBar: Bar` (Task 4)
- Produces: composant `<OrderPanel>` avec props:
  ```typescript
  {
    currentPrice: number;
    onConfirm: (order: PendingOrder) => void;
    onCancel: () => void;
    currentBarIndex: number;
  }
  ```

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

      {/* Direction toggle */}
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setDirection("LONG")}
          className="flex-1 rounded-xl py-2 text-sm font-bold transition-all"
          style={{
            backgroundColor: direction === "LONG" ? "#22c55e" : "var(--bg-surface)",
            color: direction === "LONG" ? "#fff" : "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          LONG ▲
        </button>
        <button
          type="button"
          onClick={() => setDirection("SHORT")}
          className="flex-1 rounded-xl py-2 text-sm font-bold transition-all"
          style={{
            backgroundColor: direction === "SHORT" ? "#ef4444" : "var(--bg-surface)",
            color: direction === "SHORT" ? "#fff" : "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          SHORT ▼
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {[
          { label: "Entry", value: entryPrice, onChange: setEntryPrice },
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
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
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

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/backtest/[id]/replay/OrderPanel.tsx
git commit -m "feat: OrderPanel component for entry/SL/TP order placement in replay"
```

---

## Task 6 — TradeResultModal : modal post-trade avec notes

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/TradeResultModal.tsx`

**Interfaces:**
- Consumes: `FilledTrade` type (Task 4)
- Produces: composant `<TradeResultModal>` avec props:
  ```typescript
  {
    trade: FilledTrade;
    onSave: (notes: string) => void;
    onDiscard: () => void;
    isSaving: boolean;
  }
  ```

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
  const outcomeLabel = isWin ? "WIN" : "LOSS";

  const entryDate = new Date(trade.entryBar.time * 1000).toUTCString().slice(0, 22);
  const exitDate = new Date(trade.exitBar.time * 1000).toUTCString().slice(0, 22);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Trade {outcomeLabel}
          </h2>
          <span className="text-2xl font-black" style={{ color: outcomeColor }}>
            {trade.rMultiple > 0 ? "+" : ""}{trade.rMultiple}R
          </span>
        </div>

        {/* Stats grid */}
        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          {[
            ["Direction", trade.order.direction],
            ["Entry", trade.order.entryPrice.toFixed(5)],
            ["Exit", trade.exitPrice.toFixed(5)],
            ["SL", trade.order.stopLoss.toFixed(5)],
            ["TP", trade.order.takeProfit.toFixed(5)],
            ["P&L pts", trade.pnlPoints > 0 ? `+${trade.pnlPoints.toFixed(4)}` : trade.pnlPoints.toFixed(4)],
            ["Entry date", entryDate],
            ["Exit date", exitDate],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-surface)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Notes (optionnel — PD Array HTF, structure…)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl px-3 py-2 text-sm resize-none"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            placeholder="ex: OB H4 respecté, FVG H1 comblé, Silver Bullet 10h..."
          />
        </div>

        {/* Actions */}
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

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/backtest/[id]/replay/TradeResultModal.tsx
git commit -m "feat: TradeResultModal with optional notes field for post-trade journaling"
```

---

## Task 7 — Server Action createReplayTrade

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/actions.ts`

**Interfaces:**
- Consumes: `addBacktestTrade` depuis `src/app/(app)/backtest/actions.ts`, `FilledTrade` type (Task 4)
- Produces: `createReplayTrade(backtestId, trade, notes) => Promise<string>` (retourne l'ID du trade créé)

- [ ] **Step 1: Créer actions.ts**

```typescript
// src/app/(app)/backtest/[id]/replay/actions.ts
"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

  const direction = trade.order.direction === "LONG" ? "LONG" : "SHORT";
  const outcome = trade.outcome === "WIN" ? "WIN" : "LOSS";

  const created = await prisma.backtestTrade.create({
    data: {
      backtestId,
      tradeNumber: count + 1,
      direction,
      outcome,
      entryDate: new Date(trade.entryBar.time * 1000),
      exitDate: new Date(trade.exitBar.time * 1000),
      entryPrice: trade.order.entryPrice,
      exitPrice: trade.exitPrice,
      stopLoss: trade.order.stopLoss,
      takeProfit: trade.order.takeProfit,
      rMultiple: trade.rMultiple,
      pnlPoints: trade.pnlPoints,
      notes: notes.trim() || null,
    },
    select: { id: true },
  });

  revalidatePath(`/backtest/${backtestId}`);
  return created.id;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/backtest/[id]/replay/actions.ts
git commit -m "feat: createReplayTrade server action to persist replay trades as BacktestTrade"
```

---

## Task 8 — ReplayEngine : composant chart principal

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Interfaces:**
- Consumes: `useReplayEngine` (Task 4), `OrderPanel` (Task 5), `TradeResultModal` (Task 6), `createReplayTrade` (Task 7), `Bar` type (Task 4), `lightweight-charts` npm package
- Produces: composant client `<ReplayEngine backtestId instrument initialBars />` — chart full-screen avec contrôles de replay

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

  // Initialiser le chart
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
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Mettre à jour les données visibles à chaque avance de barre
  useEffect(() => {
    if (!seriesRef.current) return;
    const data: CandlestickData[] = engine.visibleBars.map((b) => ({
      time: b.time as number,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    seriesRef.current.setData(data);
    // Scroll automatique à la dernière bougie
    if (chartRef.current && data.length > 0) {
      chartRef.current.timeScale().scrollToPosition(5, false);
    }
  }, [engine.visibleBars]);

  // Ligne de prix entry/SL/TP si ordre pending
  useEffect(() => {
    if (!seriesRef.current) return;
    // On retire les anciennes price lines avant d'en ajouter de nouvelles
    // lightweight-charts gère ça via createPriceLine/removePriceLine
    // Pour simplifier : recréer à chaque changement d'ordre
  }, [engine.pendingOrder]);

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
        <span className="text-sm font-bold" style={{ color: "#a5b4fc" }}>{instrument}</span>
        <span className="text-sm" style={{ color: "#6b7280" }}>
          {engine.currentBar
            ? new Date(engine.currentBar.time * 1000).toUTCString().slice(0, 22)
            : "—"}
        </span>
        <span className="ml-auto text-sm font-mono" style={{ color: "#f9fafb" }}>
          {currentPrice.toFixed(5)}
        </span>

        {/* Speed selector */}
        <div className="flex gap-1">
          {[1, 2, 5, 10].map((s) => (
            <button
              key={s}
              onClick={() => engine.setSpeed(s)}
              className="rounded-lg px-2 py-1 text-xs font-bold transition-all"
              style={{
                backgroundColor: engine.speed === s ? "#6366f1" : "#1f2937",
                color: engine.speed === s ? "#fff" : "#9ca3af",
              }}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Playback controls */}
        <div className="flex gap-1">
          <button
            onClick={engine.stepBackward}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
            title="Reculer 1 bougie"
          >
            ◀
          </button>
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
            title="Avancer 1 bougie"
          >
            ▶
          </button>
        </div>

        {/* Order button */}
        <button
          onClick={() => { engine.pause(); setShowOrderPanel(true); }}
          className="rounded-xl px-4 py-1.5 text-sm font-bold"
          style={{ backgroundColor: "#6366f1", color: "#fff" }}
          disabled={!!engine.pendingOrder}
        >
          {engine.pendingOrder ? "Order Active" : "+ Order"}
        </button>
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

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx package.json package-lock.json
git commit -m "feat: ReplayEngine client component with lightweight-charts, playback controls, and order UI"
```

---

## Task 9 — Page replay + chargement des données

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/page.tsx`

**Interfaces:**
- Consumes: `ReplayEngine` (Task 8), `OhlcvBar` via API route GET (Task 3), `Backtest` model via Prisma
- Produces: page server component `/backtest/[id]/replay` avec formulaire de sélection de période + chargement des bars

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

  // Si pas de période sélectionnée, afficher le formulaire de sélection
  if (!from || !to) {
    const defaultFrom = backtest.periodStart.toISOString().slice(0, 10);
    const defaultTo = backtest.periodEnd.toISOString().slice(0, 10);
    return <PeriodSelector backtestId={id} instrument={backtest.instrument} defaultFrom={defaultFrom} defaultTo={defaultTo} />;
  }

  // Charger les bars depuis la DB
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();

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
    return <NoDataScreen backtestId={id} instrument={backtest.instrument} from={from} to={to} timeframe={tf} />;
  }

  const bars: Bar[] = rawBars.map((b) => ({
    time: Number(b.timestamp) / 1000,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  return <ReplayEngine backtestId={id} instrument={backtest.instrument} initialBars={bars} />;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

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
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>From</label>
            <input type="date" name="from" defaultValue={defaultFrom} className="w-full rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>To</label>
            <input type="date" name="to" defaultValue={defaultTo} className="w-full rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Timeframe</label>
            <select name="tf" defaultValue="m1" className="w-full rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="m1">M1</option>
              <option value="m5">M5</option>
              <option value="m15">M15</option>
              <option value="h1">H1</option>
            </select>
          </div>
          <button type="submit" className="mt-2 w-full rounded-xl py-3 text-sm font-bold" style={{ backgroundColor: "#6366f1", color: "#fff" }}>
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
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {instrument} · {timeframe.toUpperCase()} · {from} → {to}
      </p>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Download data first from the backtest page.
      </p>
      <Link href={`/backtest/${backtestId}`} className="mt-2 rounded-xl px-6 py-2.5 text-sm font-bold" style={{ backgroundColor: "#6366f1", color: "#fff" }}>
        Back to Backtest
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/backtest/[id]/replay/page.tsx
git commit -m "feat: replay page with period selector, data loading, and NoData screen"
```

---

## Task 10 — Bouton Replay Mode + UI de téléchargement sur la page backtest

**Files:**
- Modify: `src/app/(app)/backtest/[id]/page.tsx`
- Create: `src/app/(app)/backtest/[id]/DownloadOhlcvButton.tsx`

**Interfaces:**
- Consumes: `/api/ohlcv/download` (Task 2), `Backtest.instrument`, `Backtest.periodStart`, `Backtest.periodEnd`
- Produces: bouton "Replay Mode" → `/backtest/[id]/replay`, bouton "Download Data" qui trigger le téléchargement Dukascopy

- [ ] **Step 1: Créer DownloadOhlcvButton.tsx**

```typescript
// src/app/(app)/backtest/[id]/DownloadOhlcvButton.tsx
"use client";

import { useState } from "react";
import { Download, Check, AlertCircle, Loader2 } from "lucide-react";

type Props = {
  instrument: string;
  periodStart: string;  // ISO date string
  periodEnd: string;    // ISO date string
};

type State = "idle" | "loading" | "success" | "error";

export function DownloadOhlcvButton({ instrument, periodStart, periodEnd }: Props) {
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<{ inserted: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleDownload() {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/ohlcv/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument,
          from: periodStart.slice(0, 10),
          to: periodEnd.slice(0, 10),
          timeframe: "m1",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Download failed");
      }
      const data = await res.json();
      setResult(data);
      setState("success");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleDownload}
        disabled={state === "loading"}
        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-all disabled:opacity-50"
        style={{
          backgroundColor:
            state === "success" ? "rgba(34,197,94,0.15)"
            : state === "error" ? "rgba(239,68,68,0.15)"
            : "var(--bg-surface)",
          color:
            state === "success" ? "#22c55e"
            : state === "error" ? "#ef4444"
            : "var(--text-muted)",
          border: "1px solid var(--border)",
        }}
      >
        {state === "loading" && <Loader2 size={13} className="animate-spin" />}
        {state === "success" && <Check size={13} />}
        {state === "error" && <AlertCircle size={13} />}
        {state === "idle" && <Download size={13} />}

        {state === "idle" && "Download M1 Data"}
        {state === "loading" && "Downloading…"}
        {state === "success" && `${result?.inserted.toLocaleString()} bars loaded`}
        {state === "error" && "Error"}
      </button>
      {state === "error" && (
        <span className="text-xs" style={{ color: "#ef4444" }}>{errorMsg}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Modifier page.tsx — ajouter bouton Replay Mode et DownloadOhlcvButton**

Dans `src/app/(app)/backtest/[id]/page.tsx`, dans la section `{/* Actions */}` (ligne ~106), ajouter avant `<DeleteButton>` :

```typescript
import Link from "next/link";
import { Play } from "lucide-react";
import { DownloadOhlcvButton } from "./DownloadOhlcvButton";
```

Et dans le JSX des actions :
```tsx
<DownloadOhlcvButton
  instrument={backtest.instrument}
  periodStart={backtest.periodStart.toISOString()}
  periodEnd={backtest.periodEnd.toISOString()}
/>
<Link
  href={`/backtest/${id}/replay`}
  className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold"
  style={{ backgroundColor: "#6366f1", color: "#fff" }}
>
  <Play size={13} /> Replay Mode
</Link>
```

- [ ] **Step 3: Vérifier que la page compile**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npx tsc --noEmit
```

Résultat attendu : 0 erreurs TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/backtest/[id]/DownloadOhlcvButton.tsx src/app/(app)/backtest/[id]/page.tsx
git commit -m "feat: add Replay Mode button and Download OHLCV button to backtest detail page"
```

---

## Task 11 — Test end-to-end du flux complet

**Files:**
- Aucun fichier créé, test manuel du flux

**Interfaces:**
- Consumes: toutes les tâches précédentes

- [ ] **Step 1: Démarrer l'app**

```bash
cd /home/gilles/DEV/TRADING/MyJournal
npm run dev
```

- [ ] **Step 2: Télécharger des données de test**

Aller sur `/backtest/<un-id-existant>`, cliquer "Download M1 Data". Vérifier que le bouton passe à `X bars loaded`.

Si le bouton reste en "Downloading…" plus de 60s, c'est normal pour une période longue (Dukascopy limite le débit). Vérifier dans les logs serveur qu'il n'y a pas d'erreur.

- [ ] **Step 3: Tester le replay**

Cliquer "Replay Mode" → sélectionner une période courte (3-5 jours) → "Load Replay".

Vérifier :
- Le chart s'affiche avec des bougies
- Les boutons ▶/⏸/◀/▶ fonctionnent
- L'autoplay avance les bougies au bon rythme (1x ≈ 1 bougie/seconde)
- Le changement de vitesse (1x/2x/5x/10x) est réactif

- [ ] **Step 4: Tester un trade complet**

1. Pauser le replay
2. Cliquer "+ Order"
3. Choisir direction, entrer entry/SL/TP
4. Confirmer → relancer le play
5. Vérifier que le modal `TradeResultModal` s'affiche quand SL ou TP est touché
6. Entrer une note "Test OB H4" → "Save Trade"
7. Retourner sur `/backtest/<id>` → vérifier que le `BacktestTrade` est apparu dans la liste avec les bonnes valeurs

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: backtest replay engine — end-to-end validated"
```

---

## Notes d'implémentation

**Instruments Dukascopy à vérifier :** `dukascopy-node` supporte `ustech` pour le NQ CFD et `spx500` pour le ES CFD. Les Futures CME (`NQ!`, `ES!`) ne sont peut-être pas disponibles — dans ce cas utiliser les CFD équivalents qui suivent le même prix.

**BigInt Prisma :** le champ `timestamp` est `BigInt` en Prisma. Ne pas oublier de sérialiser avec `Number(b.timestamp)` avant de passer au client (Next.js ne sérialise pas les BigInt nativement).

**lightweight-charts time format :** la lib attend `time` en secondes UTC (Unix timestamp / 1000), pas en millisecondes.

**Performance replay rapide :** à 10x (10 bougies/sec), `setData` sur 50k bougies peut être lent. Optimisation possible : utiliser `update()` au lieu de `setData()` pour n'ajouter que la dernière bougie. Si besoin, refactoriser `useReplayEngine` pour exposer `lastAddedBar` séparément.
