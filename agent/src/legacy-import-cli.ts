#!/usr/bin/env node
import { importLegacySessions } from "./legacy-import.ts";

function usage(): never {
  process.stderr.write(
    "用法：node legacy-import-cli.js <Prisma dev.db> <Agent SQLite> [--user-id 1] [--backup 路径] [--apply]\n默认仅 dry-run，不会创建或修改目标库。\n",
  );
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 2) usage();
const sourcePath = args[0];
const targetPath = args[1];
let userId = "1";
let backupPath: string | undefined;
let apply = false;
for (let index = 2; index < args.length; index++) {
  const arg = args[index];
  if (arg === "--apply") apply = true;
  else if (arg === "--user-id" && args[index + 1]) userId = args[++index];
  else if (arg === "--backup" && args[index + 1]) backupPath = args[++index];
  else usage();
}

try {
  const result = importLegacySessions({ sourcePath, targetPath, userId, backupPath, apply });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`旧 Agent 会话迁移失败：${(error as Error).message}\n`);
  process.exitCode = 1;
}
