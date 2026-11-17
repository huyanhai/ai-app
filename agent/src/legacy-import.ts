import { createHash } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backupDatabase } from "./backup.ts";
import { createSnowflake, parseDecimal, SNOWFLAKE_EPOCH_MS } from "./ids.ts";
import { openStore } from "./store/store.ts";

interface LegacyAttachment {
  name: string;
  type: string;
  size?: number;
  storedName?: string;
  url: string;
}

interface LegacyMessage {
  id: string;
  role: string;
  content: string;
  contentState: string | null;
  attachments: LegacyAttachment[];
  subjects: unknown[];
  mode: string;
  runId: string | null;
  createdAt: number;
}

interface LegacySession {
  id: string;
  title: string;
  canvasId: string;
  createdAt: number;
  updatedAt: number;
  messages: LegacyMessage[];
}

interface PreparedSession extends LegacySession {
  hash: string;
}

export interface LegacyImportOptions {
  sourcePath: string;
  targetPath: string;
  userId?: string;
  apply?: boolean;
  backupPath?: string;
  now?: () => number;
}

export interface LegacyImportResult {
  applied: boolean;
  backupPath: string | null;
  sessions: number;
  skipped: number;
  runs: number;
  messages: number;
  events: number;
}

type Row = Record<string, unknown>;
type SqlValue = string | number | bigint | null;

const IMPORT_TABLE = "agent_legacy_imports";

function rows(db: DatabaseSync, sql: string, ...params: (string | bigint | number)[]): Row[] {
  const statement = db.prepare(sql);
  statement.setReadBigInts(true);
  return statement.all(...params) as Row[];
}

function write(db: DatabaseSync, sql: string, ...params: SqlValue[]): void {
  const statement = db.prepare(sql);
  statement.setReadBigInts(true);
  statement.run(...params);
}

function timestamp(value: unknown, field: string): number {
  let result: number;
  if (typeof value === "bigint") result = Number(value);
  else if (typeof value === "number") result = value;
  else if (typeof value === "string" && /^\d+$/.test(value)) result = Number(BigInt(value));
  else if (typeof value === "string") result = Date.parse(value);
  else result = Number.NaN;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`旧库字段 ${field} 不是有效的毫秒时间：${String(value)}`);
  }
  return result;
}

function jsonColumn(value: unknown, field: string): unknown {
  if (value === null || value === undefined) return [];
  if (typeof value !== "string") throw new Error(`旧库字段 ${field} 不是 JSON 文本`);
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`旧库字段 ${field} 的 JSON 无法解析`, { cause: error });
  }
}

function readLegacy(path: string): PreparedSession[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec("PRAGMA query_only = ON");
    const columns = new Set(
      rows(db, "PRAGMA table_info(AgentMessage)").map((row) => String(row.name)),
    );
    const optional = (name: string, fallback: string) => (columns.has(name) ? name : fallback);
    const sessions = rows(
      db,
      "SELECT id, title, canvasId, createdAt, updatedAt FROM AgentSession ORDER BY createdAt, id",
    ).map<LegacySession>((row) => ({
      id: String(row.id),
      title: String(row.title),
      canvasId: String(row.canvasId),
      createdAt: timestamp(row.createdAt, `AgentSession(${String(row.id)}).createdAt`),
      updatedAt: timestamp(row.updatedAt, `AgentSession(${String(row.id)}).updatedAt`),
      messages: [],
    }));
    const byId = new Map(sessions.map((session) => [session.id, session]));
    const messages = rows(
      db,
      `SELECT id, sessionId, role, content, createdAt,
        ${optional("attachments", "NULL")} AS attachments,
        ${optional("subjects", "NULL")} AS subjects,
        ${optional("contentState", "NULL")} AS contentState,
        ${optional("mode", "'agent'")} AS mode,
        ${optional("runId", "NULL")} AS runId
       FROM AgentMessage ORDER BY sessionId, createdAt, id`,
    );
    for (const row of messages) {
      const sessionId = String(row.sessionId);
      const session = byId.get(sessionId);
      if (!session) throw new Error(`旧消息 ${String(row.id)} 指向不存在的会话 ${sessionId}`);
      const messageId = String(row.id);
      const attachments = jsonColumn(row.attachments, `AgentMessage(${messageId}).attachments`);
      const subjects = jsonColumn(row.subjects, `AgentMessage(${messageId}).subjects`);
      if (!Array.isArray(attachments) || !Array.isArray(subjects)) {
        throw new Error(`旧消息 ${messageId} 的 attachments/subjects 必须是数组`);
      }
      session.messages.push({
        id: messageId,
        role: String(row.role),
        content: String(row.content),
        contentState: row.contentState === null ? null : String(row.contentState),
        attachments: attachments as LegacyAttachment[],
        subjects,
        mode: String(row.mode),
        runId: row.runId === null ? null : String(row.runId),
        createdAt: timestamp(row.createdAt, `AgentMessage(${messageId}).createdAt`),
      });
    }
    return sessions.map((session) => ({
      ...session,
      hash: createHash("sha256").update(JSON.stringify(session)).digest("hex"),
    }));
  } finally {
    db.close();
  }
}

function hasImportTable(db: DatabaseSync): boolean {
  return (
    rows(
      db,
      "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?",
      IMPORT_TABLE,
    ).length > 0
  );
}

function mappingFor(db: DatabaseSync, legacyId: string): Row | undefined {
  if (!hasImportTable(db)) return undefined;
  return rows(db, `SELECT * FROM ${IMPORT_TABLE} WHERE legacy_session_id = ?`, legacyId)[0];
}

function verifyMapping(db: DatabaseSync, session: PreparedSession, mapping: Row): void {
  if (String(mapping.source_hash) !== session.hash) {
    throw new Error(`旧会话 ${session.id} 在导入后发生变化，拒绝覆盖已有映射`);
  }
  const sessionId = mapping.session_id as bigint;
  if (rows(db, "SELECT 1 AS present FROM agent_sessions WHERE id = ?", sessionId).length !== 1) {
    throw new Error(`旧会话 ${session.id} 的映射目标不存在，拒绝继续`);
  }
  const runId = mapping.run_id as bigint | null;
  if (session.messages.length === 0) {
    if (runId !== null) throw new Error(`空旧会话 ${session.id} 的映射包含运行，数据冲突`);
    return;
  }
  if (
    runId === null ||
    rows(db, "SELECT 1 AS present FROM agent_runs WHERE id = ?", runId).length !== 1
  ) {
    throw new Error(`旧会话 ${session.id} 的历史运行不存在，拒绝继续`);
  }
  const event = rows(db, "SELECT COUNT(*) AS count FROM agent_events WHERE run_id = ?", runId)[0];
  if (Number(event.count) !== Number(mapping.event_count)) {
    throw new Error(`旧会话 ${session.id} 的历史事件数量与映射不符，拒绝继续`);
  }
}

function dryRun(sessions: PreparedSession[], targetPath: string): LegacyImportResult {
  const pending = [...sessions];
  if (existsSync(targetPath)) {
    const db = new DatabaseSync(targetPath, { readOnly: true });
    try {
      db.exec("PRAGMA query_only = ON");
      for (let index = pending.length - 1; index >= 0; index--) {
        const session = pending[index];
        const mapping = mappingFor(db, session.id);
        if (!mapping) continue;
        verifyMapping(db, session, mapping);
        pending.splice(index, 1);
      }
    } finally {
      db.close();
    }
  }
  return summarize(pending, sessions.length - pending.length, false, null);
}

function summarize(
  imported: PreparedSession[],
  skipped: number,
  applied: boolean,
  backupPath: string | null,
): LegacyImportResult {
  return {
    applied,
    backupPath,
    sessions: imported.length,
    skipped,
    runs: imported.filter((session) => session.messages.length > 0).length,
    messages: imported.reduce((total, session) => total + session.messages.length, 0),
    events: imported.reduce(
      (total, session) => total + (session.messages.length > 0 ? session.messages.length + 3 : 0),
      0,
    ),
  };
}

function attachmentViews(
  session: LegacySession,
  message: LegacyMessage,
): Record<string, unknown>[] {
  return message.attachments.map((attachment, index) => {
    if (!attachment || typeof attachment !== "object") {
      throw new Error(`旧消息 ${message.id} 含无效附件`);
    }
    const name = String(attachment.name ?? "");
    const mimeType = String(attachment.type ?? "");
    const url = String(attachment.url ?? "");
    if (!name || !mimeType || !url)
      throw new Error(`旧消息 ${message.id} 的附件缺少 name/type/url`);
    return {
      asset_id: `legacy:${session.id}:${message.id}:${index}`,
      ...(mimeType.startsWith("image/") ? {} : { kind: "document" }),
      name,
      mime_type: mimeType,
      ...(typeof attachment.size === "number" && { byte_size: attachment.size }),
      url,
    };
  });
}

function messagePayload(session: LegacySession, message: LegacyMessage): Record<string, unknown> {
  const attachments = attachmentViews(session, message);
  const selection = message.subjects
    .map((subject) =>
      subject && typeof subject === "object" ? String((subject as Row).id ?? "") : "",
    )
    .filter(Boolean);
  return {
    text: message.content,
    mode: "all",
    selection,
    ...(attachments.length > 0 && { attachments }),
    legacy_role: message.role,
    legacy_id: message.id,
    legacy_mode: message.mode,
    ...(message.runId !== null && { legacy_run_id: message.runId }),
    ...(message.contentState !== null && { legacy_content_state: message.contentState }),
    ...(message.attachments.length > 0 && { legacy_attachments: message.attachments }),
    ...(message.subjects.length > 0 && { legacy_subjects: message.subjects }),
    ...(message.role !== "user" && { tool_calls: [], partial: false }),
  };
}

function applyImport(
  sessions: PreparedSession[],
  targetPath: string,
  userId: string,
  now: () => number,
): LegacyImportResult {
  const db = new DatabaseSync(targetPath);
  let skipped = 0;
  const imported: PreparedSession[] = [];
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("BEGIN IMMEDIATE");
    db.exec(`CREATE TABLE IF NOT EXISTS ${IMPORT_TABLE} (
      legacy_session_id TEXT PRIMARY KEY,
      session_id INTEGER NOT NULL UNIQUE REFERENCES agent_sessions (id),
      run_id INTEGER UNIQUE REFERENCES agent_runs (id),
      source_hash TEXT NOT NULL,
      message_count INTEGER NOT NULL,
      event_count INTEGER NOT NULL,
      imported_at INTEGER NOT NULL
    )`);
    for (const session of sessions) {
      const mapping = mappingFor(db, session.id);
      if (mapping) {
        verifyMapping(db, session, mapping);
        skipped++;
      } else imported.push(session);
    }
    const max = rows(
      db,
      `SELECT MAX(value) AS id FROM (
        SELECT MAX(id) AS value FROM agent_sessions
        UNION ALL SELECT MAX(id) FROM agent_runs
        UNION ALL SELECT MAX(id) FROM agent_events
        UNION ALL SELECT MAX(id) FROM agent_approvals
      )`,
    )[0].id as bigint | null;
    let nextId =
      max === null
        ? createSnowflake({ workerId: 0, now, notBefore: SNOWFLAKE_EPOCH_MS }).next()
        : max + 1n;
    const allocate = () => {
      const id = nextId;
      nextId++;
      return id;
    };
    const uid = parseDecimal(userId);
    for (const session of imported) {
      const sessionId = allocate();
      const runId = session.messages.length > 0 ? allocate() : null;
      write(
        db,
        `INSERT INTO agent_sessions (
          id, user_id, canvas_id, title, title_source, mode, model_key, last_seq,
          created_at, updated_at, conversation_id
        ) VALUES (?, ?, ?, ?, 'user', 'all', '', ?, ?, ?, '')`,
        sessionId,
        uid,
        session.canvasId,
        session.title,
        session.messages.length > 0 ? session.messages.length + 3 : 0,
        session.createdAt,
        session.updatedAt,
      );
      if (runId !== null) {
        const startedAt = session.messages[0].createdAt;
        const endedAt = session.messages[session.messages.length - 1].createdAt;
        write(
          db,
          `INSERT INTO agent_runs (
            id, session_id, canvas_id, user_id, status, mode, created_at, updated_at, ended_at
          ) VALUES (?, ?, ?, ?, 'succeeded', 'all', ?, ?, ?)`,
          runId,
          sessionId,
          session.canvasId,
          uid,
          startedAt,
          endedAt,
          endedAt,
        );
      }
      let seq = 0;
      const event = (runId: bigint, type: string, payload: unknown, createdAt: number) => {
        write(
          db,
          "INSERT INTO agent_events (id, session_id, run_id, seq, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          allocate(),
          sessionId,
          runId,
          ++seq,
          type,
          JSON.stringify(payload),
          createdAt,
        );
      };
      if (runId !== null) {
        const firstAt = session.messages[0].createdAt;
        event(runId, "run.status", { status: "queued" }, firstAt);
        event(runId, "run.status", { status: "running" }, firstAt);
        for (const message of session.messages) {
          event(
            runId,
            message.role === "user" ? "message.user" : "message.done",
            messagePayload(session, message),
            message.createdAt,
          );
        }
        event(
          runId,
          "run.status",
          { status: "succeeded" },
          session.messages[session.messages.length - 1].createdAt,
        );
      }
      write(
        db,
        `INSERT INTO ${IMPORT_TABLE} (
          legacy_session_id, session_id, run_id, source_hash, message_count, event_count, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        session.id,
        sessionId,
        runId,
        session.hash,
        session.messages.length,
        seq,
        now(),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    db.close();
  }
  return summarize(imported, skipped, true, null);
}

export function importLegacySessions(options: LegacyImportOptions): LegacyImportResult {
  const sourcePath = resolve(options.sourcePath);
  const targetPath = resolve(options.targetPath);
  if (sourcePath === targetPath) throw new Error("源库和目标库不能是同一个文件");
  if (!existsSync(sourcePath)) throw new Error(`源库不存在：${sourcePath}`);
  if (existsSync(targetPath)) {
    const sourceStat = statSync(sourcePath);
    const targetStat = statSync(targetPath);
    if (sourceStat.dev === targetStat.dev && sourceStat.ino === targetStat.ino) {
      throw new Error("源库和目标库不能是同一个文件");
    }
  }
  const userId = options.userId ?? "1";
  parseDecimal(userId);
  const sessions = readLegacy(sourcePath);
  if (!options.apply) return dryRun(sessions, targetPath);
  const now = options.now ?? Date.now;
  const backupPath = existsSync(targetPath)
    ? resolve(options.backupPath ?? `${targetPath}.before-legacy-import-${now()}.db`)
    : null;
  if (backupPath) backupDatabase(targetPath, backupPath);
  mkdirSync(dirname(targetPath), { recursive: true });
  const store = openStore(targetPath, { now });
  store.close();
  const imported = applyImport(sessions, targetPath, userId, now);
  return { ...imported, backupPath };
}
