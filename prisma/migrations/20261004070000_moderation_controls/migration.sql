-- AlterTable
ALTER TABLE "Subreddit" ADD COLUMN     "removedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subredditId" TEXT,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "liftedBy" TEXT,

    CONSTRAINT "UserRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "subredditId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRestriction_userId_liftedAt_expiresAt_idx" ON "UserRestriction"("userId", "liftedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "UserRestriction_subredditId_createdAt_idx" ON "UserRestriction"("subredditId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_subredditId_createdAt_idx" ON "ModerationEvent"("subredditId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationEvent_createdAt_idx" ON "ModerationEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UserRestriction" ADD CONSTRAINT "UserRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRestriction" ADD CONSTRAINT "UserRestriction_subredditId_fkey" FOREIGN KEY ("subredditId") REFERENCES "Subreddit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserRestriction" ADD CONSTRAINT "restriction_reason" CHECK (length(btrim(reason)) BETWEEN 1 AND 500);
ALTER TABLE "UserRestriction" ADD CONSTRAINT "restriction_expiry" CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt");
ALTER TABLE "UserRestriction" ADD CONSTRAINT "restriction_lift" CHECK (("liftedAt" IS NULL) = ("liftedBy" IS NULL));
ALTER TABLE "ModerationEvent" ADD CONSTRAINT "moderation_event_action" CHECK (action IN ('RESTRICT', 'LIFT', 'REMOVE_COMMUNITY', 'RESTORE_COMMUNITY'));
ALTER TABLE "UserRestriction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ModerationEvent" ENABLE ROW LEVEL SECURITY;
-- Supabase roles exist in production. Plain isolated PostgreSQL fixtures may omit them.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "UserRestriction", "ModerationEvent" FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "UserRestriction", "ModerationEvent" FROM authenticated;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'common_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "UserRestriction" TO common_app;
    GRANT SELECT, INSERT ON "ModerationEvent" TO common_app;
    REVOKE UPDATE, DELETE ON "ModerationEvent" FROM common_app;
    CREATE POLICY common_server_runtime ON "UserRestriction" FOR ALL TO common_app USING (true) WITH CHECK (true);
    CREATE POLICY common_server_runtime ON "ModerationEvent" FOR ALL TO common_app USING (true) WITH CHECK (true);
  END IF;
END $$;

