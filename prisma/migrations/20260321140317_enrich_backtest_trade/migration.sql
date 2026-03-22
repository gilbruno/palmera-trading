-- AlterTable
ALTER TABLE "BacktestTrade" ADD COLUMN     "biasHTF" "MarketBias",
ADD COLUMN     "biasMTF" "MarketBias",
ADD COLUMN     "followedRules" BOOLEAN,
ADD COLUMN     "ictModel" "IctModel",
ADD COLUMN     "isFomo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isImpulsive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRevenge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liquiditySwept" "LiquidityType",
ADD COLUMN     "marketSession" "MarketSession",
ADD COLUMN     "marketStructure" "MarketStructure",
ADD COLUMN     "poi" "PoiType",
ADD COLUMN     "timeframeEntry" "Timeframe",
ADD COLUMN     "timeframeTrend" "Timeframe";

-- CreateIndex
CREATE INDEX "BacktestTrade_backtestId_outcome_idx" ON "BacktestTrade"("backtestId", "outcome");

-- CreateIndex
CREATE INDEX "BacktestTrade_backtestId_marketSession_idx" ON "BacktestTrade"("backtestId", "marketSession");

-- CreateIndex
CREATE INDEX "BacktestTrade_backtestId_ictModel_idx" ON "BacktestTrade"("backtestId", "ictModel");
