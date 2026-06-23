# Replay Order Confirmation — Design Spec
Date: 2026-06-23

## Contexte

En mode replay backtest, l'utilisateur peut placer un composant d'ordre (overlay draggable) sur le chart. Actuellement, cliquer "Confirm" place l'ordre immédiatement et le replay continue jusqu'à ce que SL/TP soit touché, déclenchant alors la `TradeResultModal`. Ce flow manque d'une confirmation d'entrée et d'une confirmation de clôture distincte.

## Flow cible

```
[Overlay positionné] → clic Confirm toolbar
       ↓
[EntryConfirmModal] — Entry, SL, TP, Entry Date (lecture seule)
  → "Placer l'ordre"  →  createReplayTrade() partiel → activeTradeId stocké
  → "Annuler"         →  ferme modal, overlay reste en place
       ↓
[Replay reprend] — ordre actif surveillé par useReplayEngine
       ↓ SL ou TP touché → onTradeFilled()
[Replay pause auto]
       ↓
[ExitConfirmModal] — Exit price, Exit date, Outcome, R-multiple (lecture seule) + notes
  → "Sauvegarder"  →  updateReplayTrade(id, trade, notes) → fade-out smooth 1.5s
```

## Composants

### EntryConfirmModal (nouveau)
- Props: `overlayState: OrderOverlayState`, `entryBar: Bar`, `onConfirm: () => void`, `onCancel: () => void`, `isSaving: boolean`
- Affiche en lecture seule : Direction, Entry Price, SL, TP, Entry Date (formatée UTC)
- Bouton "Placer l'ordre" (indigo) → `onConfirm`
- Bouton "Annuler" → `onCancel` (overlay reste en place, modal se ferme)
- Direction artistique : même style dark que `TradeResultModal` (bg-card, border, rounded-2xl)

### ExitConfirmModal (nouveau — remplace TradeResultModal)
- Props: `trade: FilledTrade`, `onSave: (notes: string) => void`, `isSaving: boolean`
- Affiche en lecture seule : Exit price, Exit date, Outcome (WIN/LOSS coloré), R-multiple, P&L points
- Zone textarea notes (optionnel)
- Bouton "Sauvegarder" → `onSave(notes)` → après sauvegarde : fade-out smooth 1.5s via opacity transition
- Pas de bouton "Discard" — la clôture est toujours sauvegardée une fois le SL/TP touché

### TradeResultModal
- Supprimé (remplacé par ExitConfirmModal)

## Server Actions

### `createReplayTrade` (modifié)
Signature actuelle : `(backtestId, trade: FilledTrade, notes)` — crée un trade complet.

Nouvelle version : crée un trade **partiel** avec uniquement les champs d'entrée connus :
```ts
createReplayTrade(backtestId: string, entry: {
  direction, entryPrice, stopLoss, takeProfit, entryDate: Date, tradeNumber: number
}): Promise<string>  // retourne l'ID créé
```
Champs DB null à la création : `exitDate`, `exitPrice`, `outcome`, `rMultiple`, `pnlPoints`, `notes`

### `updateReplayTrade` (nouveau)
```ts
updateReplayTrade(tradeId: string, exit: {
  exitPrice, exitDate: Date, outcome, rMultiple, pnlPoints
}, notes: string): Promise<void>
```
Met à jour les champs de clôture + notes sur le trade existant.

## State dans ReplayEngine

```ts
const [activeTradeId, setActiveTradeId]   = useState<string | null>(null);
const [entryModalOpen, setEntryModalOpen] = useState(false);
const [exitModal, setExitModal]           = useState<FilledTrade | null>(null);
const [isSaving, setIsSaving]             = useState(false);
```

### Séquence phase 1
1. Clic Confirm toolbar → `setEntryModalOpen(true)`
2. Dans `EntryConfirmModal.onConfirm` :
   - `setIsSaving(true)`
   - `id = await createReplayTrade(...)`
   - `setActiveTradeId(id)`
   - `engine.placeOrder(...)` — place l'ordre dans le replay engine
   - Fermer overlay, fermer modal
   - `engine.play()` — reprend le replay
   - `setIsSaving(false)`
3. `EntryConfirmModal.onCancel` → `setEntryModalOpen(false)` — overlay reste

### Séquence phase 2
1. `useReplayEngine` détecte SL/TP → appelle `onTradeFilled(filledTrade)`
2. `handleTradeFilled` : `engine.pause()` + `setExitModal(filledTrade)`
3. Dans `ExitConfirmModal.onSave(notes)` :
   - `setIsSaving(true)`
   - `await updateReplayTrade(activeTradeId, filledTrade, notes)`
   - `setActiveTradeId(null)`, `setExitModal(null)`
   - `setIsSaving(false)`
   - Fade-out smooth 1.5s (géré dans le composant via useState opacity)

## Gestion du fade-out

Dans `ExitConfirmModal`, après `onSave` réussi :
```ts
const [visible, setVisible] = useState(true);
// après save : setVisible(false) → CSS transition opacity 0 sur 1.5s → onAnimationEnd → composant démonté
```
Le parent démonte le composant quand `exitModal === null`.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `actions.ts` | Refactoriser `createReplayTrade` (partiel) + ajouter `updateReplayTrade` |
| `EntryConfirmModal.tsx` | Créer |
| `ExitConfirmModal.tsx` | Créer (remplace TradeResultModal) |
| `TradeResultModal.tsx` | Supprimer |
| `ReplayEngine.tsx` | Nouveau state + orchestration des 2 modales, supprimer ancien Confirm inline |
