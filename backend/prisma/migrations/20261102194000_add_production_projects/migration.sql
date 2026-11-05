CREATE TABLE "ProductionProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idea" TEXT NOT NULL,
    "modelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "plan" TEXT NOT NULL,
    "nodes" TEXT NOT NULL,
    "edges" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
