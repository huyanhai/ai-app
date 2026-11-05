ALTER TABLE "GenerationRecord" ADD COLUMN "canvasId" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX "GenerationRecord_canvasId_createdAt_idx" ON "GenerationRecord"("canvasId", "createdAt");

CREATE TABLE "new_CanvasState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '未命名画布',
    "nodes" TEXT NOT NULL,
    "edges" TEXT NOT NULL,
    "past" TEXT NOT NULL DEFAULT '[]',
    "future" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_CanvasState" ("id", "title", "nodes", "edges", "past", "future", "createdAt", "updatedAt")
SELECT "id", '未命名画布', "nodes", "edges", "past", "future", "updatedAt", "updatedAt" FROM "CanvasState";

DROP TABLE "CanvasState";
ALTER TABLE "new_CanvasState" RENAME TO "CanvasState";
