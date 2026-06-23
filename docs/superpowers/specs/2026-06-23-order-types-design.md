# Order Types (Market / Limit / Stop) — Design Spec
Date: 2026-06-23

## Contexte

Le mode replay ne supporte actuellement qu'un seul type d'ordre implicite (market). Cette feature ajoute 3 types explicites — Market, Limit, Stop — avec inférence automatique selon le positionnement de l'overlay, un indicateur visuel pour les ordres en attente, et un déclenchement silencieux style FXReplay.

## Types d'ordres

| Type | Comportement |
|---|---|
| **MARKET** | Activé immédiatement au `currentBar.close` |
| **LIMIT** | Activé quand le prix *revient* au niveau entry (achat sous le marché, vente au-dessus) |
| **STOP** | Activé quand le prix *casse* le niveau entry (achat au-dessus, vente en dessous) |

## Inférence automatique du type

Recalculée à chaque drag de l'overlay. `currentPrice = currentBar.close`.

| Direction | Entry vs Prix actuel | Type inféré |
|---|---|---|
| LONG | entry < currentPrice | LIMIT BUY |
| LONG | entry > currentPrice | STOP BUY |
| LONG | entry = currentPrice (snap exact) | MARKET BUY |
| SHORT | entry > currentPrice | LIMIT SELL |
| SHORT | entry < currentPrice | STOP SELL |
| SHORT | entry = currentPrice (snap exact) | MARKET SELL |

L'utilisateur peut overrider manuellement via un dropdown dans la toolbar. Le snap Market se fait via un bouton dédié qui force `entry = currentBar.close`.

## Logique d'activation (useReplayEngine)

### Phase 1 — Pending (Limit/Stop uniquement)
L'ordre est placé mais pas encore déclenché. `checkOrderActivation` vérifie à chaque barre :

- `LIMIT LONG` : activé si `bar.low <= entryPrice`
- `LIMIT SHORT` : activé si `bar.high >= entryPrice`
- `STOP LONG` : activé si `bar.high >= entryPrice`
- `STOP SHORT` : activé si `bar.low <= entryPrice`

`MARKET` saute cette phase — il passe directement en active au moment du confirm.

### Phase 2 — Active
L'ordre surveille SL/TP. Logique identique à l'existant (`checkOrderExit`).

### État dans useReplayEngine
```ts
// AVANT
pendingOrder: PendingOrder | null  // unique état

// APRÈS
pendingOrder: PendingOrder | null  // en attente de déclenchement (Limit/Stop)
activeOrder:  PendingOrder | null  // déclenché, surveille SL/TP
```

Un seul ordre à la fois peut exister (pending OU active, jamais les deux).

## Types TypeScript

```ts
export type OrderType = "MARKET" | "LIMIT" | "STOP";

export type PendingOrder = {
  direction: "LONG" | "SHORT";
  orderType: OrderType;           // nouveau
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  placedAtIndex: number;          // renommé depuis entryBarIndex (bar où placé)
  entryBarIndex: number;          // bar où réellement exécuté (set à l'activation)
};
```

## Flow complet par type

### Market
```
Overlay snap au close → Confirm toolbar → EntryConfirmModal (affiche MARKET)
→ "Placer l'ordre" → createReplayTrade() partiel → activeOrder → replay continue
→ SL/TP touché → pause → ExitConfirmModal
```

### Limit / Stop
```
Overlay positionné → type inféré → Confirm toolbar → EntryConfirmModal (affiche LIMIT/STOP)
→ "Placer l'ordre" → pendingOrder (PAS de DB) → price line indigo pointillée sur chart
→ [replay continue] → prix atteint entryPrice → activation silencieuse
→ createReplayTrade() partiel (entryDate = barre de déclenchement) → activeOrder
→ SL/TP touché → pause → ExitConfirmModal
```

**Note importante :** Pour Limit/Stop, `createReplayTrade` est appelé au déclenchement, pas au Confirm. L'`entryDate` en DB est la date de la barre qui active l'ordre.

## Indicateur visuel ordre pending

- Price line horizontale légère, indigo pointillée, au niveau `entryPrice`
- Label : `LIMIT BUY @ 1.08450` ou `STOP SELL @ 1.08320`
- Bouton ✕ dans la toolbar (pas sur la ligne — lightweight-charts ne supporte pas les boutons inline sur price lines) → annule le pending order
- Disparaît silencieusement à l'activation

## UI — Toolbar

**Nouveautés :**
- Badge type inféré : `LIMIT BUY · E 1.08450 · SL ... · TP ...`
- Dropdown override type (à côté du badge) : sélecteur `MARKET | LIMIT | STOP`
- Bouton "Market" dédié dans les outils (entre LONG/SHORT et VWAP) : snap entry au close
- Quand pending order actif : badge `⏳ LIMIT BUY @ 1.08450` + bouton `Annuler l'ordre`

## Schéma DB

```prisma
enum OrderType {
  MARKET
  LIMIT
  STOP
}

model BacktestTrade {
  // ... champs existants ...
  orderType OrderType @default(MARKET)  // nouveau
}
```

Migration : `prisma migrate dev --name add_order_type`

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `prisma/schema.prisma` | Enum `OrderType` + champ `orderType` sur `BacktestTrade` |
| `useReplayEngine.ts` | `PendingOrder` étendu, `activeOrder` state, `checkOrderActivation` + `checkOrderExit`, `onOrderActivated` callback |
| `ReplayEngine.tsx` | Inférence type, bouton Market, price line pending, override dropdown, annulation pending |
| `actions.ts` | `TradeEntry` étendu avec `orderType` |
| `EntryConfirmModal.tsx` | Affiche le type d'ordre |

## Callbacks useReplayEngine

```ts
type UseReplayEngineOpts = {
  onTradeFilled: (trade: FilledTrade) => void;
  onOrderActivated?: (order: PendingOrder, activationBar: Bar) => void; // nouveau
};
```

`onOrderActivated` est appelé quand un Limit/Stop se déclenche → `ReplayEngine` crée le trade en DB et passe l'ordre en `activeOrder`.

## Annulation d'un ordre pending

- Bouton "Annuler l'ordre" dans toolbar → `engine.cancelPendingOrder()`
- Price line supprimée
- Aucun impact DB (le trade n'a pas encore été créé)
