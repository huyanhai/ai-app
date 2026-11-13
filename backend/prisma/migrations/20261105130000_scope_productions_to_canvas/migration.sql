ALTER TABLE "ProductionProject" ADD COLUMN "canvasId" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX "ProductionProject_canvasId_updatedAt_idx" ON "ProductionProject"("canvasId", "updatedAt");
