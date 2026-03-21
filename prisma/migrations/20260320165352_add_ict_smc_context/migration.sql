-- CreateEnum
CREATE TYPE "IctModel" AS ENUM ('ICT_2022', 'SILVER_BULLET', 'JUDAS_SWING', 'LONDON_OPEN_RECAP', 'POWER_OF_3', 'BREAKER_BLOCK', 'MITIGATION_BLOCK', 'PROPULSION_BLOCK', 'FVG_FILL', 'OTE', 'TURTLE_SOUP', 'SCALP', 'OTHER');

-- CreateEnum
CREATE TYPE "PoiType" AS ENUM ('ORDER_BLOCK_BULL', 'ORDER_BLOCK_BEAR', 'BREAKER_BLOCK_BULL', 'BREAKER_BLOCK_BEAR', 'FVG_BULL', 'FVG_BEAR', 'IFVG_BULL', 'IFVG_BEAR', 'MITIGATION_BLOCK_BULL', 'MITIGATION_BLOCK_BEAR', 'LIQUIDITY_VOID', 'PREMIUM_ARRAY', 'DISCOUNT_ARRAY', 'EQUILIBRIUM', 'WEEKLY_OPEN', 'DAILY_OPEN', 'MIDNIGHT_OPEN', 'LONDON_OPEN', 'ASIA_HIGH', 'ASIA_LOW', 'PREV_DAY_HIGH', 'PREV_DAY_LOW', 'PREV_WEEK_HIGH', 'PREV_WEEK_LOW');

-- CreateEnum
CREATE TYPE "MarketSession" AS ENUM ('ASIA', 'LONDON', 'LONDON_CLOSE', 'NEW_YORK_AM', 'NEW_YORK_PM', 'SILVER_BULLET_AM', 'SILVER_BULLET_PM', 'OVERLAP', 'OFF_HOURS');

-- CreateEnum
CREATE TYPE "MarketBias" AS ENUM ('BULLISH', 'BEARISH', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "MarketStructure" AS ENUM ('HH_HL', 'LH_LL', 'RANGE', 'BOS_UP', 'BOS_DOWN', 'CHOCH_UP', 'CHOCH_DOWN');

-- CreateEnum
CREATE TYPE "LiquidityType" AS ENUM ('BSL', 'SSL', 'BOTH', 'NONE');

-- CreateTable
CREATE TABLE "IctContext" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "ictModel" "IctModel",
    "ictModelNotes" TEXT,
    "poi" "PoiType",
    "poiTimeframe" "Timeframe",
    "poiNotes" TEXT,
    "marketSession" "MarketSession",
    "biasHTF" "MarketBias",
    "biasMTF" "MarketBias",
    "biasLTF" "MarketBias",
    "structureHTF" "MarketStructure",
    "structureLTF" "MarketStructure",
    "hasChoch" BOOLEAN NOT NULL DEFAULT false,
    "hasBos" BOOLEAN NOT NULL DEFAULT false,
    "liquiditySwept" "LiquidityType",
    "liquidityTargeted" "LiquidityType",
    "liquidityNotes" TEXT,
    "hasFvg" BOOLEAN NOT NULL DEFAULT false,
    "hasOrderBlock" BOOLEAN NOT NULL DEFAULT false,
    "hasBreakerBlock" BOOLEAN NOT NULL DEFAULT false,
    "hasInversion" BOOLEAN NOT NULL DEFAULT false,
    "hasImbalance" BOOLEAN NOT NULL DEFAULT false,
    "isOte" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isDiscount" BOOLEAN NOT NULL DEFAULT false,
    "isAtEquilibrium" BOOLEAN NOT NULL DEFAULT false,
    "usedWeeklyOpen" BOOLEAN NOT NULL DEFAULT false,
    "usedDailyOpen" BOOLEAN NOT NULL DEFAULT false,
    "usedMidnightOpen" BOOLEAN NOT NULL DEFAULT false,
    "usedAsiaHigh" BOOLEAN NOT NULL DEFAULT false,
    "usedAsiaLow" BOOLEAN NOT NULL DEFAULT false,
    "usedPdh" BOOLEAN NOT NULL DEFAULT false,
    "usedPdl" BOOLEAN NOT NULL DEFAULT false,
    "waitedKillZone" BOOLEAN NOT NULL DEFAULT false,
    "hadLtfConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "entryType" TEXT,
    "confluenceNotes" TEXT,
    "mistakeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IctContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IctContext_tradeId_key" ON "IctContext"("tradeId");

-- CreateIndex
CREATE INDEX "IctContext_ictModel_idx" ON "IctContext"("ictModel");

-- CreateIndex
CREATE INDEX "IctContext_poi_idx" ON "IctContext"("poi");

-- CreateIndex
CREATE INDEX "IctContext_marketSession_idx" ON "IctContext"("marketSession");

-- CreateIndex
CREATE INDEX "IctContext_biasHTF_idx" ON "IctContext"("biasHTF");

-- AddForeignKey
ALTER TABLE "IctContext" ADD CONSTRAINT "IctContext_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
