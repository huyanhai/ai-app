CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "referenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "urls" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "GenerationJob_createdAt_idx" ON "GenerationJob"("createdAt");
