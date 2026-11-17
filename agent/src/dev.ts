import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
process.chdir(workspaceRoot);

const defaults = {
  AGENT_SERVICE_TOKEN: "development-only-agent-token-0123456789abcdef",
  AGENT_DB_PATH: "agent/data/agent.db",
  AGENT_BRIDGE_URL: "http://127.0.0.1:3000/internal/platform/v1",
  AGENT_ID_KEY: "development-only",
  AGENT_LISTEN: "127.0.0.1:8090",
} as const;

for (const [key, value] of Object.entries(defaults)) process.env[key] ??= value;

await import("./serve.ts");
