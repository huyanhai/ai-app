ALTER TABLE "AgentSession" ADD COLUMN "canvasId" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX "AgentSession_canvasId_updatedAt_idx" ON "AgentSession"("canvasId", "updatedAt");
