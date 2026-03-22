-- BetterAuth core tables
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "whitelisted" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'user',

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- Unique indexes for BetterAuth tables
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- Foreign keys for BetterAuth tables
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add userId to existing tables (nullable first, then fill, then set NOT NULL)

-- Setup
ALTER TABLE "Setup" ADD COLUMN "userId" TEXT;
-- Remove the old global unique constraint on name and add per-user unique
ALTER TABLE "Setup" DROP CONSTRAINT IF EXISTS "Setup_name_key";

-- Tag
ALTER TABLE "Tag" ADD COLUMN "userId" TEXT;
ALTER TABLE "Tag" DROP CONSTRAINT IF EXISTS "Tag_name_key";

-- TradingSession
ALTER TABLE "TradingSession" ADD COLUMN "userId" TEXT;
ALTER TABLE "TradingSession" DROP CONSTRAINT IF EXISTS "TradingSession_date_key";

-- Trade
ALTER TABLE "Trade" ADD COLUMN "userId" TEXT;

-- EquitySnapshot
ALTER TABLE "EquitySnapshot" ADD COLUMN "userId" TEXT;
ALTER TABLE "EquitySnapshot" DROP CONSTRAINT IF EXISTS "EquitySnapshot_date_snapshotType_key";

-- JournalEntry
ALTER TABLE "JournalEntry" ADD COLUMN "userId" TEXT;

-- Delete orphaned dev data that has no userId (cannot be migrated without a real user)
DELETE FROM "JournalEntry" WHERE "tradeId" IN (SELECT "id" FROM "Trade");
DELETE FROM "TradeTag" WHERE "tradeId" IN (SELECT "id" FROM "Trade");
DELETE FROM "Screenshot" WHERE "tradeId" IN (SELECT "id" FROM "Trade");
DELETE FROM "TradeExecution" WHERE "tradeId" IN (SELECT "id" FROM "Trade");
DELETE FROM "IctContext" WHERE "tradeId" IN (SELECT "id" FROM "Trade");
DELETE FROM "Trade";
DELETE FROM "Setup";
DELETE FROM "Tag";
DELETE FROM "TradingSession";
DELETE FROM "EquitySnapshot";
DELETE FROM "JournalEntry";

-- Make userId NOT NULL
ALTER TABLE "Setup" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Tag" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "TradingSession" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Trade" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "EquitySnapshot" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "JournalEntry" ALTER COLUMN "userId" SET NOT NULL;

-- Add new unique constraints (per-user)
CREATE UNIQUE INDEX "Setup_userId_name_key" ON "Setup"("userId", "name");
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");
CREATE UNIQUE INDEX "TradingSession_userId_date_key" ON "TradingSession"("userId", "date");
CREATE UNIQUE INDEX "EquitySnapshot_userId_date_snapshotType_key" ON "EquitySnapshot"("userId", "date", "snapshotType");

-- Add indexes on userId
CREATE INDEX "Setup_userId_idx" ON "Setup"("userId");
CREATE INDEX "Tag_userId_idx" ON "Tag"("userId");
CREATE INDEX "TradingSession_userId_idx" ON "TradingSession"("userId");
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");
CREATE INDEX "EquitySnapshot_userId_idx" ON "EquitySnapshot"("userId");
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- Foreign key constraints linking to user
ALTER TABLE "Setup" ADD CONSTRAINT "Setup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TradingSession" ADD CONSTRAINT "TradingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquitySnapshot" ADD CONSTRAINT "EquitySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
