# Palmera Trading — Journal de trading

Application web privée de journalisation et d'analyse pour traders actifs. Construite avec Next.js 16, React 19, Prisma et PostgreSQL.

## Fonctionnalités

- **Dashboard** — vue d'ensemble personnalisée avec calendrier économique hebdomadaire
- **Trades** — saisie, filtrage et suivi de tous vos trades (outcome, R-multiple, setup associé)
- **Setups** — bibliothèque de setups avec statistiques calculées (Win Rate, Avg R) et statut actif/inactif
- **Backtest** — simulation de setups sur données historiques avec métriques complètes (winrate, profit factor, expectancy, total R)
- **Position Size Calculator** — calcul de taille de position en temps réel pour Forex, indices, actions et crypto, avec validation de direction et ratio R:R

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19, TailwindCSS 4, Lucide React |
| Auth | Better Auth |
| ORM | Prisma 7 + PostgreSQL (adapter `pg`) |
| Stockage | AWS S3 |
| Package manager | pnpm 10 |

## Prérequis

- Node.js >= 20
- pnpm >= 10
- PostgreSQL

## Installation

```bash
pnpm install
```

Créez un fichier `.env` à la racine en vous basant sur `.env.example` :

```env
DATABASE_URL="postgresql://user:password@localhost:5432/palmera"
BETTER_AUTH_SECRET="..."
AWS_BUCKET_NAME="..."
AWS_REGION="..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
```

Appliquez les migrations et générez le client Prisma :

```bash
pnpm prisma migrate deploy
pnpm prisma generate
```

## Développement

```bash
pnpm dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

## Production

```bash
pnpm build
pnpm start
```

`pnpm build` exécute automatiquement `prisma generate` avant le build Next.js.

## Structure du projet

```
src/
  app/
    (app)/            # Routes protégées (authentification requise)
      dashboard/      # Page d'accueil
      trades/         # Journal des trades
      setups/         # Bibliothèque de setups
      backtest/       # Backtests
      position-size/  # Calculateur de taille de position
    (auth)/           # Pages d'authentification
  components/         # Composants réutilisables
  lib/                # Auth, Prisma client, utilitaires
  generated/          # Client Prisma généré
```

## Licence

Usage privé — tous droits réservés.
