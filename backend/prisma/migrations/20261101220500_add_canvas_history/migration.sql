CREATE TABLE "CanvasState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodes" TEXT NOT NULL,
    "edges" TEXT NOT NULL,
    "past" TEXT NOT NULL DEFAULT '[]',
    "future" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "GenerationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "model" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GenerationRecord_createdAt_idx" ON "GenerationRecord"("createdAt");
