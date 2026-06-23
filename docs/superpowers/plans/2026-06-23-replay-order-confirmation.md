# Replay Order Confirmation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le flow de confirmation d'ordre en mode replay par un process en 2 étapes : modale d'entrée (avant placement) + modale de clôture (quand SL/TP touché), avec sauvegarde en DB en 2 temps.

**Architecture:** Le trade est créé partiellement en DB lors de la confirmation d'entrée (exit = null), puis mis à jour lors de la clôture. `EntryConfirmModal` orchestre la phase 1, `ExitConfirmModal` la phase 2 avec fade-out 1.5s. `ReplayEngine` coordonne les deux via `activeTradeId` state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, Tailwind CSS, lightweight-charts

## Global Constraints

- Fichiers dans `src/app/(app)/backtest/[id]/replay/`
- Couleurs dark : bg `#0f1117`, surface `#1f2937`, indigo `#6366f1`, text-muted `#6b7280`, text `#f9fafb`
- Même style que les modales existantes : `rounded-2xl`, `shadow-2xl`, `backdrop-blur-sm`, `bg-black/60` pour l'overlay
- TypeScript strict — pas de `any` non justifié
- Pas de librairie d'animation externe — utiliser CSS `transition` natif

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `actions.ts` | Modifier + Ajouter | `createReplayTrade` partiel + `updateReplayTrade` |
| `EntryConfirmModal.tsx` | Créer | Modale phase 1 — récap entrée, lecture seule |
| `ExitConfirmModal.tsx` | Créer | Modale phase 2 — récap clôture + notes + fade-out |
| `TradeResultModal.tsx` | Supprimer | Remplacé par ExitConfirmModal |
| `ReplayEngine.tsx` | Modifier | Nouveau state, orchestration 2 modales, suppression ancien flow |

---

## Task 1 — Refactoriser `actions.ts` : création partielle + update

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/actions.ts`

**Interfaces:**
- Produit:
  - `createReplayTrade(backtestId: string, entry: { direction: "LONG"|"SHORT", entryPrice: number, stopLoss: number, takeProfit: number, entryDate: Date }): Promise<string>`
  - `updateReplayTrade(tradeId: string, exit: { exitPrice: number, exitDate: Date, outcome: "WIN"|"LOSS", rMultiple: number, pnlPoints: number }, notes: string): Promise<void>`

- [ ] **Step 1: Remplacer le contenu de `actions.ts`**

```typescript
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type TradeEntry = {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryDate: Date;
};

export type TradeExit = {
  exitPrice: number;
  exitDate: Date;
  outcome: "WIN" | "LOSS";
  rMultiple: number;
  pnlPoints: number;
};

export async function createReplayTrade(
  backtestId: string,
  entry: TradeEntry
): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const backtest = await prisma.backtest.findFirst({
    where: { id: backtestId, userId: session.user.id },
    select: { id: true },
  });
  if (!backtest) throw new Error("Backtest not found.");

  const max = await prisma.backtestTrade.aggregate({
    where: { backtestId },
    _max: { tradeNumber: true },
  });
  const tradeNumber = (max._max.tradeNumber ?? 0) + 1;

  const created = await prisma.backtestTrade.create({
    data: {
      backtestId,
      tradeNumber,
      direction:  entry.direction,
      entryDate:  entry.entryDate,
      entryPrice: entry.entryPrice,
      stopLoss:   entry.stopLoss,
      takeProfit: entry.takeProfit,
      // exit fields left null — filled in by updateReplayTrade
    },
    select: { id: true },
  });

  revalidatePath(`/backtest/${backtestId}`);
  return created.id;
}

export async function updateReplayTrade(
  tradeId: string,
  exit: TradeExit,
  notes: string
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  await prisma.backtestTrade.update({
    where: { id: tradeId },
    data: {
      exitDate:  exit.exitDate,
      exitPrice: exit.exitPrice,
      outcome:   exit.outcome,
      rMultiple: exit.rMultiple,
      pnlPoints: exit.pnlPoints,
      notes:     notes.trim() || null,
    },
  });

  // Récupérer le backtestId pour revalidatePath
  const trade = await prisma.backtestTrade.findUnique({
    where: { id: tradeId },
    select: { backtestId: true },
  });
  if (trade) revalidatePath(`/backtest/${trade.backtestId}`);
}
```

- [ ] **Step 2: Vérifier que TypeScript compile**

```bash
cd /home/gilles/DEV/TRADING/MyJournal && npx tsc --noEmit 2>&1 | grep "actions"
```
Résultat attendu : aucune ligne d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/actions.ts
git commit -m "feat(replay): split createReplayTrade partial + add updateReplayTrade"
```

---

## Task 2 — Créer `EntryConfirmModal`

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/EntryConfirmModal.tsx`

**Interfaces:**
- Consomme: `OrderOverlayState` de `./OrderOverlay` (champs : `direction`, `entry`, `sl`, `tp`), `Bar` de `./useReplayEngine`
- Produit: composant `EntryConfirmModal` avec props :
  ```ts
  type Props = {
    overlayState: { direction: "LONG"|"SHORT"; entry: number; sl: number; tp: number };
    entryBar: Bar;
    onConfirm: () => void;
    onCancel: () => void;
    isSaving: boolean;
  }
  ```

- [ ] **Step 1: Créer `EntryConfirmModal.tsx`**

```typescript
"use client";

import type { Bar } from "./useReplayEngine";

type OverlaySummary = {
  direction: "LONG" | "SHORT";
  entry: number;
  sl: number;
  tp: number;
};

type Props = {
  overlayState: OverlaySummary;
  entryBar: Bar;
  onConfirm: () => void;
  onCancel: () => void;
  isSaving: boolean;
};

const fmtPrice = (n: number) => n.toFixed(5);
const fmtDate  = (ts: number) => new Date(ts * 1000).toUTCString().slice(0, 22);

export function EntryConfirmModal({ overlayState, entryBar, onConfirm, onCancel, isSaving }: Props) {
  const isLong = overlayState.direction === "LONG";
  const dirColor = isLong ? "#22c55e" : "#ef4444";

  const rows: [string, string][] = [
    ["Direction",   overlayState.direction],
    ["Entry Price", fmtPrice(overlayState.entry)],
    ["Stop Loss",   fmtPrice(overlayState.sl)],
    ["Take Profit", fmtPrice(overlayState.tp)],
    ["Entry Date",  fmtDate(entryBar.time)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "#0f1117", border: "1px solid #1f2937" }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "#f9fafb" }}>
            Confirmer l&apos;entrée
          </h2>
          <span
            className="rounded-lg px-2 py-0.5 text-xs font-bold uppercase"
            style={{ backgroundColor: dirColor + "22", color: dirColor }}
          >
            {overlayState.direction}
          </span>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-2">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ backgroundColor: "#1f2937" }}
            >
              <span className="text-xs" style={{ color: "#6b7280" }}>{label}</span>
              <span className="font-mono text-sm font-semibold" style={{ color: "#f9fafb" }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#6366f1", color: "#fff" }}
          >
            {isSaving ? "Placement…" : "Placer l'ordre"}
          </button>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold"
            style={{ backgroundColor: "#1f2937", color: "#6b7280", border: "1px solid #374151" }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "EntryConfirmModal"
```
Résultat attendu : aucune ligne d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/EntryConfirmModal.tsx
git commit -m "feat(replay): add EntryConfirmModal for phase-1 order confirmation"
```

---

## Task 3 — Créer `ExitConfirmModal`

**Files:**
- Create: `src/app/(app)/backtest/[id]/replay/ExitConfirmModal.tsx`

**Interfaces:**
- Consomme: `FilledTrade` de `./useReplayEngine`
- Produit: composant `ExitConfirmModal` avec props :
  ```ts
  type Props = {
    trade: FilledTrade;
    onSave: (notes: string) => Promise<void>;
    isSaving: boolean;
  }
  ```
  Le fade-out 1.5s est géré **en interne** : après `onSave` résolu, le composant passe `opacity-0` puis appelle `onDone` (pas besoin côté parent — le parent démonte sur `exitModal === null` qui est mis à null dans `onSave` du parent).

  Correction : la prop correcte est :
  ```ts
  type Props = {
    trade: FilledTrade;
    onSave: (notes: string) => Promise<void>;
    isSaving: boolean;
  }
  ```
  Le fade-out est géré par un state local `fading`. Quand `isSaving` passe de `true` à `false` après save, le composant déclenche le fade. Le parent retire le composant quand `exitModal === null`.

- [ ] **Step 1: Créer `ExitConfirmModal.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import type { FilledTrade } from "./useReplayEngine";

type Props = {
  trade: FilledTrade;
  onSave: (notes: string) => Promise<void>;
  isSaving: boolean;
};

const fmtPrice = (n: number) => n.toFixed(5);
const fmtDate  = (ts: number) => new Date(ts * 1000).toUTCString().slice(0, 22);

export function ExitConfirmModal({ trade, onSave, isSaving }: Props) {
  const [notes, setNotes]   = useState("");
  const [fading, setFading] = useState(false);
  const [saved, setSaved]   = useState(false);

  const isWin       = trade.outcome === "WIN";
  const outcomeColor = isWin ? "#22c55e" : "#ef4444";
  const rSign        = trade.rMultiple >= 0 ? "+" : "";

  async function handleSave() {
    await onSave(notes);
    setSaved(true);
  }

  // Déclenche le fade-out 300ms après que saved=true
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setFading(true), 300);
    return () => clearTimeout(t);
  }, [saved]);

  const rows: [string, string][] = [
    ["Direction",  trade.order.direction],
    ["Entry",      fmtPrice(trade.order.entryPrice)],
    ["Exit",       fmtPrice(trade.exitPrice)],
    ["SL",         fmtPrice(trade.order.stopLoss)],
    ["TP",         fmtPrice(trade.order.takeProfit)],
    ["R-multiple", `${rSign}${trade.rMultiple}R`],
    ["P&L pts",    (trade.pnlPoints > 0 ? "+" : "") + trade.pnlPoints.toFixed(4)],
    ["Exit Date",  fmtDate(trade.exitBar.time)],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{
        opacity: fading ? 0 : 1,
        transition: fading ? "opacity 1.5s ease-out" : undefined,
        pointerEvents: fading ? "none" : undefined,
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "#0f1117", border: "1px solid #1f2937" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold" style={{ color: "#f9fafb" }}>
            Trade{" "}
            <span style={{ color: outcomeColor }}>{trade.outcome}</span>
          </h2>
          <span className="text-2xl font-black" style={{ color: outcomeColor }}>
            {rSign}{trade.rMultiple}R
          </span>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg px-3 py-2" style={{ backgroundColor: "#1f2937" }}>
              <p className="text-xs" style={{ color: "#6b7280" }}>{label}</p>
              <p className="font-mono font-semibold" style={{ color: "#f9fafb" }}>{value}</p>
            </div>
          ))}
        </div>

        {!saved && (
          <>
            <div className="mb-4">
              <label
                className="mb-1 block text-xs font-semibold uppercase tracking-widest"
                style={{ color: "#6b7280" }}
              >
                Notes (optionnel — OB, FVG, structure…)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl px-3 py-2 text-sm"
                style={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  color: "#f9fafb",
                  outline: "none",
                }}
                placeholder="ex: OB H4 respecté, FVG H1 comblé, Silver Bullet 10h…"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full cursor-pointer rounded-xl py-2.5 text-sm font-bold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#6366f1", color: "#fff" }}
            >
              {isSaving ? "Sauvegarde…" : "Sauvegarder le trade"}
            </button>
          </>
        )}

        {saved && (
          <div className="flex items-center justify-center py-2">
            <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>
              ✓ Trade sauvegardé
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "ExitConfirmModal"
```
Résultat attendu : aucune ligne d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/ExitConfirmModal.tsx
git commit -m "feat(replay): add ExitConfirmModal for phase-2 exit confirmation with fade-out"
```

---

## Task 4 — Mettre à jour `ReplayEngine.tsx`

**Files:**
- Modify: `src/app/(app)/backtest/[id]/replay/ReplayEngine.tsx`

**Interfaces:**
- Consomme:
  - `EntryConfirmModal` (props: `overlayState`, `entryBar: Bar`, `onConfirm`, `onCancel`, `isSaving`)
  - `ExitConfirmModal` (props: `trade: FilledTrade`, `onSave: (notes) => Promise<void>`, `isSaving`)
  - `createReplayTrade(backtestId, { direction, entryPrice, stopLoss, takeProfit, entryDate: Date }): Promise<string>`
  - `updateReplayTrade(tradeId, { exitPrice, exitDate, outcome, rMultiple, pnlPoints }, notes): Promise<void>`

- [ ] **Step 1: Mettre à jour les imports**

Remplacer dans les imports du fichier :
```typescript
// AVANT
import { TradeResultModal } from "./TradeResultModal";
import { createReplayTrade } from "./actions";

// APRÈS
import { EntryConfirmModal } from "./EntryConfirmModal";
import { ExitConfirmModal } from "./ExitConfirmModal";
import { createReplayTrade, updateReplayTrade } from "./actions";
```

- [ ] **Step 2: Remplacer le state lié au flow de trade**

Remplacer dans le composant `ReplayEngine` :
```typescript
// AVANT
const [pendingTrade, setPendingTrade] = useState<FilledTrade | null>(null);
const [isSaving, setIsSaving] = useState(false);

// APRÈS
const [entryModalOpen, setEntryModalOpen] = useState(false);
const [exitModal, setExitModal]           = useState<FilledTrade | null>(null);
const [activeTradeId, setActiveTradeId]   = useState<string | null>(null);
const [isSaving, setIsSaving]             = useState(false);
```

- [ ] **Step 3: Remplacer `handleTradeFilled`**

Remplacer :
```typescript
// AVANT
const handleTradeFilled = useCallback((trade: FilledTrade) => {
  setPendingTrade(trade);
}, []);

// APRÈS
const handleTradeFilled = useCallback((trade: FilledTrade) => {
  engine.pause();
  setExitModal(trade);
}, [engine]);
```

Note: `engine` doit être accessible ici — dans ReplayEngine.tsx, `engine` est défini avant ce callback via `useReplayEngine`. Vérifier que `engine` est bien dans la closure. Si nécessaire, utiliser `engineRef` pattern déjà en place.

- [ ] **Step 4: Remplacer `handleSaveTrade` par les deux handlers phase 1 et 2**

Remplacer :
```typescript
// AVANT
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

// APRÈS
async function handleEntryConfirm() {
  if (!overlayState || !engine.currentBar) return;
  setIsSaving(true);
  try {
    const id = await createReplayTrade(backtestId, {
      direction:  overlayState.direction,
      entryPrice: overlayState.entry,
      stopLoss:   overlayState.sl,
      takeProfit: overlayState.tp,
      entryDate:  new Date(engine.currentBar.time * 1000),
    });
    setActiveTradeId(id);
    engine.placeOrder({
      direction:     overlayState.direction,
      entryPrice:    overlayState.entry,
      stopLoss:      overlayState.sl,
      takeProfit:    overlayState.tp,
      entryBarIndex: engine.currentIndex,
    });
    overlayStateRef.current = null;
    setOverlayState(null);
    orderOverlayRef.current?.clear();
    if (overlayDivRef.current) overlayDivRef.current.style.pointerEvents = "none";
    setEntryModalOpen(false);
    engine.play();
  } finally {
    setIsSaving(false);
  }
}

async function handleExitSave(notes: string) {
  if (!exitModal || !activeTradeId) return;
  setIsSaving(true);
  try {
    await updateReplayTrade(
      activeTradeId,
      {
        exitPrice: exitModal.exitPrice,
        exitDate:  new Date(exitModal.exitBar.time * 1000),
        outcome:   exitModal.outcome,
        rMultiple: exitModal.rMultiple,
        pnlPoints: exitModal.pnlPoints,
      },
      notes
    );
    setActiveTradeId(null);
    // Laisser 1.8s pour le fade-out avant de démonter
    setTimeout(() => setExitModal(null), 1800);
  } finally {
    setIsSaving(false);
  }
}
```

- [ ] **Step 5: Remplacer le bouton Confirm dans la toolbar**

Trouver le bloc `{overlayState && (...)}` dans le JSX toolbar et remplacer :

```typescript
// AVANT
{overlayState && (
  <>
    <span className="text-xs font-mono" style={{ color: "#6b7280" }}>
      E {overlayState.entry.toFixed(5)} · SL {overlayState.sl.toFixed(5)} · TP {overlayState.tp.toFixed(5)}
    </span>
    <button
      onClick={() => {
        engine.pause();
        engine.placeOrder({ direction: overlayState.direction, entryPrice: overlayState.entry, stopLoss: overlayState.sl, takeProfit: overlayState.tp, entryBarIndex: engine.currentIndex });
        overlayStateRef.current = null; setOverlayState(null); orderOverlayRef.current?.clear();
        if (overlayDivRef.current) overlayDivRef.current.style.pointerEvents = "none";
      }}
      className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold"
      style={{ backgroundColor: "#6366f1", color: "#fff" }}
    >Confirm</button>
    <button
      onClick={() => { overlayStateRef.current = null; setOverlayState(null); orderOverlayRef.current?.clear(); if (overlayDivRef.current) overlayDivRef.current.style.pointerEvents = "none"; }}
      className="cursor-pointer flex h-5 w-5 items-center justify-center rounded"
      style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
    ><X size={11} /></button>
  </>
)}

// APRÈS
{overlayState && (
  <>
    <span className="text-xs font-mono" style={{ color: "#6b7280" }}>
      E {overlayState.entry.toFixed(5)} · SL {overlayState.sl.toFixed(5)} · TP {overlayState.tp.toFixed(5)}
    </span>
    <button
      onClick={() => { engine.pause(); setEntryModalOpen(true); }}
      className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold"
      style={{ backgroundColor: "#6366f1", color: "#fff" }}
    >
      Confirm
    </button>
    <button
      onClick={() => {
        overlayStateRef.current = null;
        setOverlayState(null);
        orderOverlayRef.current?.clear();
        if (overlayDivRef.current) overlayDivRef.current.style.pointerEvents = "none";
      }}
      className="cursor-pointer flex h-5 w-5 items-center justify-center rounded"
      style={{ backgroundColor: "#1f2937", color: "#9ca3af" }}
    >
      <X size={11} />
    </button>
  </>
)}
```

- [ ] **Step 6: Remplacer les modales dans le JSX**

Trouver le bloc `{/* Trade result modal */}` et remplacer :

```typescript
// AVANT
{pendingTrade && (
  <TradeResultModal
    trade={pendingTrade}
    onSave={handleSaveTrade}
    onDiscard={() => setPendingTrade(null)}
    isSaving={isSaving}
  />
)}

// APRÈS
{entryModalOpen && overlayState && engine.currentBar && (
  <EntryConfirmModal
    overlayState={overlayState}
    entryBar={engine.currentBar}
    onConfirm={handleEntryConfirm}
    onCancel={() => { setEntryModalOpen(false); engine.play(); }}
    isSaving={isSaving}
  />
)}

{exitModal && (
  <ExitConfirmModal
    trade={exitModal}
    onSave={handleExitSave}
    isSaving={isSaving}
  />
)}
```

- [ ] **Step 7: Supprimer l'import de `TradeResultModal`**

Vérifier qu'il n'y a plus aucune référence à `TradeResultModal` dans le fichier :

```bash
grep -n "TradeResultModal\|pendingTrade\|handleSaveTrade" src/app/\(app\)/backtest/\[id\]/replay/ReplayEngine.tsx
```
Résultat attendu : aucune ligne.

- [ ] **Step 8: Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "ReplayEngine|EntryConfirm|ExitConfirm|actions"
```
Résultat attendu : aucune ligne d'erreur.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/backtest/\[id\]/replay/ReplayEngine.tsx
git commit -m "feat(replay): wire EntryConfirmModal + ExitConfirmModal, 2-phase trade save"
```

---

## Task 5 — Supprimer `TradeResultModal.tsx`

**Files:**
- Delete: `src/app/(app)/backtest/[id]/replay/TradeResultModal.tsx`

- [ ] **Step 1: Vérifier qu'aucun fichier n'importe encore TradeResultModal**

```bash
grep -r "TradeResultModal" /home/gilles/DEV/TRADING/MyJournal/src --include="*.tsx" --include="*.ts"
```
Résultat attendu : aucune ligne.

- [ ] **Step 2: Supprimer le fichier**

```bash
rm src/app/\(app\)/backtest/\[id\]/replay/TradeResultModal.tsx
```

- [ ] **Step 3: Vérifier TypeScript final**

```bash
npx tsc --noEmit 2>&1
```
Résultat attendu : aucune erreur.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat(replay): remove TradeResultModal, replaced by 2-phase confirmation flow"
```

---

## Self-Review Checklist

- [x] **Spec coverage** — EntryConfirmModal ✓, ExitConfirmModal ✓, createReplayTrade partiel ✓, updateReplayTrade ✓, fade-out 1.5s ✓, lecture seule ✓, notes dans ExitConfirm ✓, pause auto replay ✓
- [x] **Placeholders** — aucun TBD/TODO dans le plan
- [x] **Type consistency** — `TradeEntry`, `TradeExit` définis en Task 1 et utilisés identiquement en Task 4. `FilledTrade` importé de `./useReplayEngine` partout. `overlayState` type cohérent entre Task 2 et Task 4.
- [x] **Edge case `handleTradeFilled`** — `engine` doit être accessible dans le callback. Dans ReplayEngine, `engine` est défini avant le callback. Si le linter se plaint de dépendance circulaire, utiliser un `engineRef` (pattern déjà présent dans le fichier pour d'autres usages).
