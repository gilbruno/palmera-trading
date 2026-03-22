# Economic Calendar Card — Options d'implémentation

## Contexte

La card "Weekly Economic Calendar" est déjà en place dans le dashboard (`WeeklyEconomicCard.tsx`).
Elle s'affiche uniquement le weekend (samedi/dimanche) et est censée afficher les événements de la semaine suivante.

**Problème actuel** : ForexFactory (`nfs.faireconomy.media`) bloque les requêtes serveur (rate limit 429).
L'URL `ff_calendar_nextweek.json` retourne aussi 404 en semaine (elle n'existe que le weekend).
La card affiche donc "Economic calendar unavailable".

---

## Option 1 — FMP (Financial Modeling Prep) — RECOMMANDEE

**Clé gratuite : 250 req/jour**

- Inscription : https://financialmodelingprep.com (30 secondes, pas de CB)
- Endpoint : `GET /api/v3/economic_calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&apikey=<KEY>`
- Données : USD, EUR, GBP, JPY, CAD, AUD, CHF, NZD avec champ `impact` (Low/Medium/High)
- Avec cache 1h en place : max 24 req/jour en usage normal, largement dans le free tier

**Pour activer** :
1. Créer un compte sur financialmodelingprep.com
2. Copier la clé API dans `.env` :
   ```
   FMP_API_KEY=votre_clé_ici
   ```
3. Me dire "implémente option 1" — je mets à jour `WeeklyEconomicCard.tsx`

**Avantages** : données complètes multi-devises, fiable, format propre
**Inconvénients** : nécessite une clé API (gratuite), 250 req/jour (suffisant avec cache)

---

## Option 2 — FRED API (Federal Reserve) — US uniquement

**Entièrement gratuit, clé instantanée**

- Inscription : https://fred.stlouisfed.org/docs/api/api_key.html
- Données : indicateurs macroéconomiques US uniquement (NFP, CPI, PPI, FOMC, GDP, etc.)
- Endpoint : `GET /fred/releases/dates?api_key=<KEY>&file_type=json`

**Pour activer** :
1. Créer un compte sur fred.stlouisfed.org
2. Copier la clé dans `.env` :
   ```
   FRED_API_KEY=votre_clé_ici
   ```
3. Me dire "implémente option 2"

**Avantages** : 100% gratuit, données officielles Fed, aucune limite pratique
**Inconvénients** : US uniquement (pas EUR, GBP, JPY…), format moins adapté au trading Forex

---

## Option 3 — Données statiques algorithmiques — SANS API

**Aucune configuration nécessaire**

On calcule algorithmiquement les dates des événements récurrents majeurs :

| Événement | Devise | Récurrence |
|-----------|--------|------------|
| Non-Farm Payrolls | USD | 1er vendredi du mois |
| CPI | USD | ~2ème mardi du mois |
| FOMC Meeting | USD | 8x/an (dates fixes) |
| ECB Rate Decision | EUR | 8x/an (dates fixes) |
| BOE Rate Decision | GBP | 8x/an (dates fixes) |
| BOJ Rate Decision | JPY | ~8x/an |
| Retail Sales | USD | ~2ème mercredi du mois |
| GDP | USD | Trimestriel |

**Pour activer** : Me dire "implémente option 3" — aucune clé, aucune inscription

**Avantages** : zéro dépendance externe, toujours fonctionnel, aucune config
**Inconvénients** : événements limités aux récurrents connus, pas de forecast/previous, dates approximatives (±1 jour parfois)

---

## Comparatif rapide

| Critère | Option 1 (FMP) | Option 2 (FRED) | Option 3 (Statique) |
|---------|---------------|-----------------|---------------------|
| Config | Clé gratuite | Clé gratuite | Aucune |
| Devises | Toutes | USD uniquement | Principales |
| Fiabilité | Haute | Haute | Moyenne |
| Forecast/Previous | Oui | Oui | Non |
| Dépendance externe | Oui | Oui | Non |
| Recommandation | **Meilleure** | Si USD only | Si pas d'inscription |
