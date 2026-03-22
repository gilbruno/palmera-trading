-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "PlanAdherence" AS ENUM ('YES', 'PARTIAL', 'NO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmotionLevel" AS ENUM ('CONFIDENT', 'CALM', 'NEUTRAL', 'ANXIOUS', 'FEARFUL', 'GREEDY', 'FRUSTRATED', 'EUPHORIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop redundant journal_trade tables
DROP TABLE IF EXISTS "journal_trade_media";
DROP TABLE IF EXISTS "journal_trade";

-- AlterTable: add emotion and planAdherence to Trade
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "emotion" "EmotionLevel";
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "planAdherence" "PlanAdherence";
