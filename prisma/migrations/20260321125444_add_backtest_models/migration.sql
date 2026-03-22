-- CreateEnum
CREATE TYPE "BacktestStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- DropIndex
DROP INDEX "EquitySnapshot_date_snapshotType_key";

-- DropIndex
DROP INDEX "Setup_name_idx";

-- DropIndex
DROP INDEX "Setup_name_key";

-- DropIndex
DROP INDEX "Tag_name_idx";

-- DropIndex
DROP INDEX "Tag_name_key";

-- DropIndex
DROP INDEX "TradingSession_date_key";

-- CreateTable
CREATE TABLE "Backtest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instrument" TEXT NOT NULL,
    "timeframe" "Timeframe",
    "setupId" TEXT,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "initialCapital" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "riskPerTrade" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" "BacktestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Backtest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestTrade" (
    "id" TEXT NOT NULL,
    "backtestId" TEXT NOT NULL,
    "tradeNumber" INTEGER NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "exitDate" TIMESTAMP(3),
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "direction" "Direction" NOT NULL,
    "outcome" "TradeOutcome",
    "rMultiple" DOUBLE PRECISION,
    "pnlPoints" DOUBLE PRECISION,
    "pnlDollars" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "grade" INTEGER,
    "notes" TEXT,
    "tags" TEXT[],
    "screenshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Backtest_userId_idx" ON "Backtest"("userId");

-- CreateIndex
CREATE INDEX "Backtest_setupId_idx" ON "Backtest"("setupId");

-- CreateIndex
CREATE INDEX "Backtest_status_idx" ON "Backtest"("status");

-- CreateIndex
CREATE INDEX "Backtest_userId_status_idx" ON "Backtest"("userId", "status");

-- CreateIndex
CREATE INDEX "BacktestTrade_backtestId_idx" ON "BacktestTrade"("backtestId");

-- CreateIndex
CREATE INDEX "BacktestTrade_backtestId_tradeNumber_idx" ON "BacktestTrade"("backtestId", "tradeNumber");

-- AddForeignKey
ALTER TABLE "Backtest" ADD CONSTRAINT "Backtest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backtest" ADD CONSTRAINT "Backtest_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_backtestId_fkey" FOREIGN KEY ("backtestId") REFERENCES "Backtest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
