const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

type Envelope = {
  code?: number | string;
  msg?: string;
  message?: string;
  data?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const successfulCode = (code: unknown) =>
  code === undefined || code === null || code === 0 || code === 200 || code === "0" || code === "200";

export class AgentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number | string,
  ) {
    super(message);
    this.name = "AgentApiError";
  }
}

export function unwrapAgentResponse<T>(body: unknown, status = 200): T {
  if (!isRecord(body) || !("code" in body)) return body as T;
  const envelope = body as Envelope;
  if (!successfulCode(envelope.code)) {
    throw new AgentApiError(
      envelope.msg || envelope.message || "Agent 请求失败",
      status,
      envelope.code,
    );
  }
  return envelope.data as T;
}

export async function agentRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) query.set(key, String(value));
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${API_BASE}/agent${path}${suffix}`, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const error = isRecord(body) ? (body as Envelope) : {};
    throw new AgentApiError(
      error.msg || error.message || `Agent 请求失败（${response.status}）`,
      response.status,
      error.code,
    );
  }
  if (!text || response.status === 204) return undefined as T;
  return unwrapAgentResponse<T>(body, response.status);
}

export const agentUrl = (path: string) => `${API_BASE}/agent${path}`;

export function agentWebSocketUrl(canvasId: string): string {
  const url = new URL(agentUrl("/events"), window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("canvasId", canvasId);
  return url.toString();
}
