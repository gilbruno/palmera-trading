-- CreateTable
CREATE TABLE "backtest_trade_media" (
    "id"         TEXT         NOT NULL,
    "tradeId"    TEXT         NOT NULL,
    "url"        TEXT         NOT NULL,
    "storageKey" TEXT         NOT NULL,
    "filename"   TEXT,
    "mimeType"   TEXT,
    "sizeBytes"  INTEGER,
    "caption"    TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backtest_trade_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backtest_trade_media_tradeId_idx" ON "backtest_trade_media"("tradeId");

-- AddForeignKey
ALTER TABLE "backtest_trade_media"
    ADD CONSTRAINT "backtest_trade_media_tradeId_fkey"
    FOREIGN KEY ("tradeId")
    REFERENCES "BacktestTrade"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
