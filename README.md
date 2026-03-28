# Palmera Trading — Trading Journal

A comprehensive private web application for active traders to log, analyze, and backtest their trading strategies. Built with Next.js 16, React 19, Prisma, and PostgreSQL with advanced ICT/SMC market analysis capabilities.

## Screenshots

| Login | Dashboard |
|---|---|
| ![Login](public/images/screenshots/login_palmera_trading.png) | ![Dashboard](public/images/screenshots/dashboard_palmera_trading.png) |

| Trades | Backtest |
|---|---|
| ![Trades](public/images/screenshots/trades_palmera_trading.png) | ![Backtest](public/images/screenshots/backtest_palmera_trading.png) |

## Features

- **Dashboard** — customized overview with weekly economic calendar and equity tracking
- **Trade Journal** — comprehensive entry, filtering, and tracking of all trades (outcome, R-multiple, setup, ICT/SMC context)
- **Setups/Playbooks** — setup library with auto-calculated statistics (Win Rate, Avg R) and active/inactive management
- **Backtest Module** — backtesting setups on historical data with complete metrics (winrate, profit factor, expectancy, total R, alternative scenarios)
- **Position Size Calculator** — real-time position sizing for Forex, indices, stocks, and crypto, with risk validation and R:R ratio
- **ICT/SMC Analysis** — track market structure, order blocks, FVG, liquidity, market bias, and confluence factors
- **Trading Sessions** — daily session tracking with mood, energy, pnl, rule adherence, and emotion management
- **Journal Entries** — reflections, lessons learned, trading plans, and rules with mood tracking
- **Multi-user Support** — whitelist-based authentication with Better Auth

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| UI | React 19, TailwindCSS 4, Lucide React |
| Animations | GSAP 3.14 |
| Auth | Better Auth (multi-user with email whitelist) |
| Database | Prisma 7 + PostgreSQL (`pg` adapter) |
| Storage | AWS S3 (chart screenshots, uploads) |
| Package manager | pnpm 10 |
| Styling | TailwindCSS 4, dark/light mode support |

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- PostgreSQL

## Installation

```bash
pnpm install
```

Create a `.env` file in the root directory based on `.env.example`:

```env
# Database (PostgreSQL/Neon)
DATABASE_URL="postgresql://user:password@localhost:5432/palmera"

# Better Auth
BETTER_AUTH_SECRET="your-secret-here"

# AWS S3 (for screenshot uploads)
AWS_BUCKET_NAME="your-bucket-name"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
```

Apply migrations and generate the Prisma client:

```bash
pnpm prisma migrate deploy
pnpm prisma generate
```

## Development

```bash
pnpm dev
```

The application is accessible at [http://localhost:3000](http://localhost:3000).

## Production

```bash
pnpm build
pnpm start
```

`pnpm build` automatically runs `prisma generate` before the Next.js build.

## Project Structure

```
src/
  app/
    (app)/            # Protected routes (authentication required)
      dashboard/      # Home page with equity overview
      trades/         # Trade journal and analytics
      setups/         # Setup playbook library
      backtest/       # Backtesting engine
      position-size/  # Position size calculator
    (auth)/           # Authentication pages
    api/              # API routes (auth, uploads, etc)
  components/         # Reusable React components
  lib/                # Auth config, Prisma client, utilities
  generated/          # Generated Prisma client and types
```

## Database

The project uses a comprehensive Prisma schema with support for:
- **Multi-user authentication** via Better Auth with email whitelist
- **Trade tracking** with detailed P&L, execution, and risk metrics
- **Setup management** with win rate and R-multiple statistics
- **ICT/SMC analysis** (market bias, structure, POI, FVG, order blocks, etc.)
- **Backtesting** with alternative exit scenarios (1R, 1.5R outcomes)
- **Trading sessions** with mood, energy, and rule adherence tracking
- **Journal entries** (reflections, lessons, trading plans)
- **Equity snapshots** (daily, weekly, monthly tracking)
- **Screenshots & media** (chart screenshots stored in AWS S3)

## Key Concepts

### Trading Metrics
- **R-multiple**: Risk-to-reward ratio (how much was won/lost relative to initial risk)
- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Gross profit / Gross loss
- **Expectancy**: Average R-multiple per trade

### Market Analysis (ICT/SMC)
Supported market structure elements:
- **Order Blocks** (bullish/bearish mitigation)
- **FVG** (Fair Value Gap, including IFVG)
- **Breaker Blocks**
- **Liquidity** (buy-side, sell-side, swept vs targeted)
- **Market Bias** (HTF, MTF, LTF — bullish, bearish, neutral)
- **POI** (Points of Interest — weekly open, daily open, London open, etc.)

### Trading Psychology
Track emotional state and decision quality:
- **Emotions**: Confident, Calm, Neutral, Anxious, Fearful, Greedy, Frustrated, Euphoric
- **Rule Adherence**: Did the trade follow your setup rules?
- **Plan Adherence**: Did you stick to your pre-trade plan?
- **Behavioral Flags**: Revenge trading, FOMO, impulsive entries

## Deployment

This app is optimized for **Vercel** with:
- Next.js 16 (Edge functions ready)
- Prisma with PostgreSQL (Neon compatible)
- Environment variables pre-configured for Vercel

Deploy from Git or use:
```bash
vercel deploy
```

## License

Private use — all rights reserved.
