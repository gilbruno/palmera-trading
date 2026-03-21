-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('FOREX', 'CRYPTO', 'STOCKS', 'FUTURES', 'OPTIONS', 'CFD', 'COMMODITIES', 'INDICES', 'BONDS');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'PARTIAL', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Timeframe" AS ENUM ('M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN');

-- CreateEnum
CREATE TYPE "TradeOutcome" AS ENUM ('WIN', 'LOSS', 'BREAKEVEN');

-- CreateEnum
CREATE TYPE "MoodLevel" AS ENUM ('EXCELLENT', 'GOOD', 'NEUTRAL', 'BAD', 'TERRIBLE');

-- CreateEnum
CREATE TYPE "EquitySnapshotType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL', 'DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "JournalEntryType" AS ENUM ('REFLECTION', 'LESSON', 'PLAN', 'IDEA', 'RULE', 'FREE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Setup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "entryRules" TEXT,
    "exitRules" TEXT,
    "riskRules" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "winRate" DECIMAL(5,2),
    "avgRMultiple" DECIMAL(8,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeTag" (
    "tradeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TradeTag_pkey" PRIMARY KEY ("tradeId","tagId")
);

-- CreateTable
CREATE TABLE "TradingSession" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "preMood" "MoodLevel",
    "prePlan" TEXT,
    "energyLevel" INTEGER,
    "sleepHours" DECIMAL(4,1),
    "postMood" "MoodLevel",
    "postNotes" TEXT,
    "lessonLearned" TEXT,
    "totalPnl" DECIMAL(15,4),
    "tradeCount" INTEGER DEFAULT 0,
    "winCount" INTEGER DEFAULT 0,
    "lossCount" INTEGER DEFAULT 0,
    "breakevenCount" INTEGER DEFAULT 0,
    "ruleAdherence" INTEGER,
    "hadRevenge" BOOLEAN NOT NULL DEFAULT false,
    "hadFomo" BOOLEAN NOT NULL DEFAULT false,
    "wasOvertraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL,
    "direction" "Direction" NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "sessionId" TEXT,
    "setupId" TEXT,
    "entryTime" TIMESTAMP(3) NOT NULL,
    "exitTime" TIMESTAMP(3),
    "durationSec" INTEGER,
    "timeframeTrend" "Timeframe",
    "timeframeEntry" "Timeframe",
    "entryPrice" DECIMAL(20,8) NOT NULL,
    "exitPrice" DECIMAL(20,8),
    "stopLoss" DECIMAL(20,8),
    "takeProfit1" DECIMAL(20,8),
    "takeProfit2" DECIMAL(20,8),
    "takeProfit3" DECIMAL(20,8),
    "quantity" DECIMAL(20,8) NOT NULL,
    "lotSize" DECIMAL(10,4),
    "riskPercent" DECIMAL(6,4),
    "riskAmount" DECIMAL(15,4),
    "accountCurrency" TEXT NOT NULL DEFAULT 'USD',
    "commission" DECIMAL(12,4),
    "swap" DECIMAL(12,4),
    "slippage" DECIMAL(10,4),
    "pnlGross" DECIMAL(15,4),
    "pnlNet" DECIMAL(15,4),
    "rMultiple" DECIMAL(8,4),
    "pipsResult" DECIMAL(10,2),
    "mae" DECIMAL(20,8),
    "mfe" DECIMAL(20,8),
    "maeR" DECIMAL(8,4),
    "mfeR" DECIMAL(8,4),
    "efficiency" DECIMAL(6,2),
    "outcome" "TradeOutcome",
    "marketContext" TEXT,
    "catalyst" TEXT,
    "qualityScore" INTEGER,
    "preTradeNotes" TEXT,
    "postTradeNotes" TEXT,
    "executionNotes" TEXT,
    "mistakeNotes" TEXT,
    "isRevengeTraded" BOOLEAN NOT NULL DEFAULT false,
    "isFomo" BOOLEAN NOT NULL DEFAULT false,
    "isImpulsive" BOOLEAN NOT NULL DEFAULT false,
    "followedRules" BOOLEAN,
    "brokerTradeId" TEXT,
    "brokerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeExecution" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "commission" DECIMAL(12,4),
    "swap" DECIMAL(12,4),
    "executedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "TradeExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT,
    "sessionId" TEXT,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "filename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "timeframe" "Timeframe",
    "chartType" TEXT,
    "caption" TEXT,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquitySnapshot" (
    "id" TEXT NOT NULL,
    "snapshotType" "EquitySnapshotType" NOT NULL DEFAULT 'DAILY',
    "date" DATE NOT NULL,
    "equity" DECIMAL(18,4) NOT NULL,
    "totalDeposits" DECIMAL(18,4),
    "totalWithdrawals" DECIMAL(18,4),
    "tradingCapital" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "drawdown" DECIMAL(8,4),
    "drawdownAmount" DECIMAL(15,4),
    "peakEquity" DECIMAL(18,4),
    "periodPnl" DECIMAL(15,4),
    "periodTrades" INTEGER,
    "periodWins" INTEGER,
    "periodLosses" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "type" "JournalEntryType" NOT NULL DEFAULT 'FREE',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "tradeId" TEXT,
    "sessionId" TEXT,
    "mood" "MoodLevel",
    "importance" INTEGER DEFAULT 3,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "entryDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Setup_name_key" ON "Setup"("name");

-- CreateIndex
CREATE INDEX "Setup_isActive_idx" ON "Setup"("isActive");

-- CreateIndex
CREATE INDEX "Setup_name_idx" ON "Setup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "TradeTag_tagId_idx" ON "TradeTag"("tagId");

-- CreateIndex
CREATE INDEX "TradingSession_date_idx" ON "TradingSession"("date");

-- CreateIndex
CREATE UNIQUE INDEX "TradingSession_date_key" ON "TradingSession"("date");

-- CreateIndex
CREATE INDEX "Trade_entryTime_idx" ON "Trade"("entryTime");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "Trade_assetClass_idx" ON "Trade"("assetClass");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Trade_setupId_idx" ON "Trade"("setupId");

-- CreateIndex
CREATE INDEX "Trade_sessionId_idx" ON "Trade"("sessionId");

-- CreateIndex
CREATE INDEX "Trade_direction_idx" ON "Trade"("direction");

-- CreateIndex
CREATE INDEX "Trade_outcome_idx" ON "Trade"("outcome");

-- CreateIndex
CREATE INDEX "Trade_reviewStatus_idx" ON "Trade"("reviewStatus");

-- CreateIndex
CREATE INDEX "Trade_assetClass_entryTime_idx" ON "Trade"("assetClass", "entryTime");

-- CreateIndex
CREATE INDEX "Trade_symbol_entryTime_idx" ON "Trade"("symbol", "entryTime");

-- CreateIndex
CREATE INDEX "TradeExecution_tradeId_idx" ON "TradeExecution"("tradeId");

-- CreateIndex
CREATE INDEX "TradeExecution_executedAt_idx" ON "TradeExecution"("executedAt");

-- CreateIndex
CREATE INDEX "Screenshot_tradeId_idx" ON "Screenshot"("tradeId");

-- CreateIndex
CREATE INDEX "Screenshot_sessionId_idx" ON "Screenshot"("sessionId");

-- CreateIndex
CREATE INDEX "EquitySnapshot_date_idx" ON "EquitySnapshot"("date");

-- CreateIndex
CREATE INDEX "EquitySnapshot_snapshotType_idx" ON "EquitySnapshot"("snapshotType");

-- CreateIndex
CREATE UNIQUE INDEX "EquitySnapshot_date_snapshotType_key" ON "EquitySnapshot"("date", "snapshotType");

-- CreateIndex
CREATE INDEX "JournalEntry_type_idx" ON "JournalEntry"("type");

-- CreateIndex
CREATE INDEX "JournalEntry_entryDate_idx" ON "JournalEntry"("entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_tradeId_idx" ON "JournalEntry"("tradeId");

-- CreateIndex
CREATE INDEX "JournalEntry_sessionId_idx" ON "JournalEntry"("sessionId");

-- CreateIndex
CREATE INDEX "JournalEntry_isPinned_idx" ON "JournalEntry"("isPinned");

-- AddForeignKey
ALTER TABLE "TradeTag" ADD CONSTRAINT "TradeTag_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeTag" ADD CONSTRAINT "TradeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TradingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_setupId_fkey" FOREIGN KEY ("setupId") REFERENCES "Setup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeExecution" ADD CONSTRAINT "TradeExecution_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TradingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TradingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
