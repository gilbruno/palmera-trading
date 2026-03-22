-- Create WhitelistedEmail table
CREATE TABLE "whitelisted_email" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whitelisted_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whitelisted_email_email_key" ON "whitelisted_email"("email");

-- Remove the whitelisted column from user (no longer needed)
ALTER TABLE "user" DROP COLUMN IF EXISTS "whitelisted";
