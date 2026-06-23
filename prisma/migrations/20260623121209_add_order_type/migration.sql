-- Create new enum type
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP');

-- Add orderType column to BacktestTrade
ALTER TABLE "BacktestTrade" ADD COLUMN "orderType" "OrderType" NOT NULL DEFAULT 'MARKET';
