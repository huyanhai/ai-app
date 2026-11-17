import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { importLegacySessions } from "../src/legacy-import.ts";

const NOW = 1_800_000_000_000;
const USER_ID = "1152921504606846977";

function directory(): string {
  return mkdtempSync(join(tmpdir(), "agent-legacy-import-"));
}

function createSource(path: string): void {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE AgentSession (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      canvasId TEXT NOT NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );
    CREATE TABLE AgentMessage (
      id INTEGER PRIMARY KEY,
      sessionId TEXT NOT NULL REFERENCES AgentSession(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      contentState TEXT,
      attachments TEXT,
      subjects TEXT,
      mode TEXT NOT NULL DEFAULT 'agent',
      runId TEXT,
      createdAt DATETIME NOT NULL
    );
  `);
  const session = db.prepare(
    "INSERT INTO AgentSession (id, title, canvasId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
  );
  session.run(
    USER_ID,
    "保留标题",
    "0c7062b1-e6dd-4f5b-b89c-64a54b07d054",
    1_700_000_000_000,
    1_700_000_000_020,
  );
  session.run("empty-session", "空会话", "canvas-2", 1_700_000_000_100, 1_700_000_000_100);
  const message = db.prepare(
    `INSERT INTO AgentMessage (
      id, sessionId, role, content, contentState, attachments, subjects, mode, runId, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  message.setReadBigInts(true);
  message.run(
    1,
    USER_ID,
    "user",
    "旧问题",
    JSON.stringify({ type: "doc" }),
    JSON.stringify([
      {
        name: "参考.txt",
        type: "text/plain",
        size: 12,
        storedName: "stored.txt",
        url: `/agent/sessions/${USER_ID}/files/stored.txt`,
      },
    ]),
    JSON.stringify([{ id: "node-1", name: "角色" }]),
    "agent",
    "legacy-run",
    1_700_000_000_010,
  );
  message.run(
    9_007_199_254_740_993n,
    USER_ID,
    "assistant",
    "旧回答",
    null,
    "[]",
    "[]",
    "agent",
    "legacy-run",
    1_700_000_000_020,
  );
  db.close();
}

function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function targetRows(path: string, sql: string): Record<string, unknown>[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const statement = db.prepare(sql);
    statement.setReadBigInts(true);
    return statement.all() as Record<string, unknown>[];
  } finally {
    db.close();
  }
}

test("dry-run 不写库，apply 保留历史并幂等跳过", () => {
  const root = directory();
  const source = join(root, "source.db");
  const target = join(root, "agent.db");
  const backup = join(root, "backup.db");
  try {
    createSource(source);
    const sourceDigest = digest(source);
    const preview = importLegacySessions({
      sourcePath: source,
      targetPath: target,
      userId: USER_ID,
    });
    assert.deepEqual(preview, {
      applied: false,
      backupPath: null,
      sessions: 2,
      skipped: 0,
      runs: 1,
      messages: 2,
      events: 5,
    });
    assert.equal(existsSync(target), false);

    const first = importLegacySessions({
      sourcePath: source,
      targetPath: target,
      userId: USER_ID,
      apply: true,
      now: () => NOW,
    });
    assert.deepEqual(first, { ...preview, applied: true });
    assert.equal(digest(source), sourceDigest);

    const sessions = targetRows(target, "SELECT * FROM agent_sessions ORDER BY created_at");
    assert.equal(sessions.length, 2);
    assert.equal(sessions[0].user_id, BigInt(USER_ID));
    assert.equal(sessions[0].canvas_id, "0c7062b1-e6dd-4f5b-b89c-64a54b07d054");
    assert.equal(sessions[0].title, "保留标题");
    assert.equal(sessions[0].title_source, "user");
    assert.equal(sessions[0].conversation_id, "");
    assert.equal(sessions[0].created_at, 1_700_000_000_000n);
    assert.equal(sessions[0].last_seq, 5n);
    const runs = targetRows(target, "SELECT * FROM agent_runs");
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "succeeded");
    assert.equal(runs[0].ended_at, 1_700_000_000_020n);

    const events = targetRows(target, "SELECT * FROM agent_events ORDER BY seq");
    assert.deepEqual(
      events.map((event) => event.type),
      ["run.status", "run.status", "message.user", "message.done", "run.status"],
    );
    const user = JSON.parse(String(events[2].payload)) as Record<string, unknown>;
    assert.equal(user.text, "旧问题");
    assert.equal(user.legacy_role, "user");
    assert.equal(user.legacy_content_state, JSON.stringify({ type: "doc" }));
    assert.deepEqual(user.selection, ["node-1"]);
    const attachments = user.attachments as Record<string, unknown>[];
    assert.equal(attachments[0].kind, "document");
    assert.equal(attachments[0].url, `/agent/sessions/${USER_ID}/files/stored.txt`);
    const assistant = JSON.parse(String(events[3].payload)) as Record<string, unknown>;
    assert.equal(assistant.text, "旧回答");
    assert.equal(assistant.legacy_role, "assistant");
    assert.equal(assistant.legacy_id, "9007199254740993");

    const second = importLegacySessions({
      sourcePath: source,
      targetPath: target,
      userId: USER_ID,
      backupPath: backup,
      apply: true,
      now: () => NOW + 1,
    });
    assert.deepEqual(second, {
      applied: true,
      backupPath: backup,
      sessions: 0,
      skipped: 2,
      runs: 0,
      messages: 0,
      events: 0,
    });
    assert.equal(existsSync(backup), true);
    assert.equal(targetRows(target, "SELECT * FROM agent_sessions").length, 2);
    assert.equal(targetRows(target, "SELECT * FROM agent_events").length, 5);
    assert.equal(digest(source), sourceDigest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("旧会话变化或映射目标缺失时冲突报错，不覆盖目标", () => {
  const root = directory();
  const source = join(root, "source.db");
  const target = join(root, "agent.db");
  try {
    createSource(source);
    importLegacySessions({ sourcePath: source, targetPath: target, apply: true, now: () => NOW });
    const before = digest(target);
    const db = new DatabaseSync(source);
    db.prepare("UPDATE AgentSession SET title = ? WHERE id = ?").run("已改变", USER_ID);
    db.close();
    assert.throws(
      () =>
        importLegacySessions({
          sourcePath: source,
          targetPath: target,
          apply: true,
          now: () => NOW + 1,
        }),
      /发生变化/,
    );
    assert.equal(digest(target), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
