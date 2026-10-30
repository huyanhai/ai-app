ALTER TABLE "AgentMessage" ADD COLUMN "attachments" TEXT;
ALTER TABLE "AgentMessage" ADD COLUMN "subjects" TEXT;
ALTER TABLE "AgentMessage" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'agent';
