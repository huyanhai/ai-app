import type { AgentEventDto, CanvasPatchDto } from "@/api/agent/type";
import { agentWebSocketUrl } from "./http";
import { subscribeLiveAgentEvents, useAgentStore } from "@/store/agent";
import { publishCanvasPatch } from "./patch-bus";
import { activeRunId } from "./session-state";

const MAX_RECONNECT_DELAY_MS = 15_000;
const ACTIVE_POLL_INTERVAL_MS = 1_000;
const BACKGROUND_POLL_INTERVAL_MS = 15_000;

type CanvasConnection = {
  clients: number;
  socket: WebSocket | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectDelay: number;
  pollTimer: ReturnType<typeof setTimeout> | null;
  polling: boolean;
  unsubscribe: () => void;
};

const connections = new Map<string, CanvasConnection>();

export function isAgentCanvasConnected(canvasId: string): boolean {
  return connections.get(canvasId)?.socket?.readyState === WebSocket.OPEN;
}

function loadedSessionIds(canvasId: string): string[] {
  const store = useAgentStore.getState();
  return (store.sessionsByCanvas[canvasId] ?? [])
    .map((session) => session.id)
    .filter((sessionId) => {
      const state = store.sessions[sessionId];
      return Boolean(
        state &&
          (state.historyReady || state.events.length > 0 || Object.keys(state.runs).length > 0),
      );
    });
}

function syncSessions(canvasId: string) {
  const store = useAgentStore.getState();
  return Promise.allSettled(loadedSessionIds(canvasId).map((id) => store.sync(id)));
}

function activeSignature(canvasId: string): string {
  const store = useAgentStore.getState();
  return (store.sessionsByCanvas[canvasId] ?? [])
    .map((session) => {
      const state = store.sessions[session.id];
      const runId = state ? activeRunId(state) : null;
      return runId ? `${session.id}:${runId}` : "";
    })
    .filter(Boolean)
    .join(",");
}

function pollDelay(canvasId: string): number | null {
  if (!activeSignature(canvasId)) return null;
  if (typeof document !== "undefined" && document.hidden) return BACKGROUND_POLL_INTERVAL_MS;
  return ACTIVE_POLL_INTERVAL_MS;
}

function schedulePoll(canvasId: string, connection: CanvasConnection, delay = pollDelay(canvasId)) {
  if (connection.pollTimer) clearTimeout(connection.pollTimer);
  connection.pollTimer = null;
  if (connection.clients === 0 || delay === null) return;
  connection.pollTimer = setTimeout(() => {
    connection.pollTimer = null;
    void poll(canvasId, connection);
  }, delay);
}

async function poll(canvasId: string, connection: CanvasConnection) {
  if (connection.polling || connection.clients === 0) return;
  connection.polling = true;
  try {
    await syncSessions(canvasId);
  } finally {
    connection.polling = false;
    schedulePoll(canvasId, connection);
  }
}

type AgentWireEvent = Omit<AgentEventDto, "canvas_id"> & {
  canvas_id: string | null;
};

function isAgentEvent(value: unknown): value is AgentWireEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<AgentWireEvent>;
  return typeof event.session_id === "string" &&
    (typeof event.canvas_id === "string" || event.canvas_id === null) &&
    (typeof event.run_id === "string" || event.run_id === null) &&
    typeof event.seq === "number" && Number.isSafeInteger(event.seq) && event.seq >= 0 &&
    typeof event.type === "string" && typeof event.created_at === "string" &&
    Boolean(event.data) && typeof event.data === "object";
}

function scheduleReconnect(canvasId: string, connection: CanvasConnection) {
  if (connection.clients === 0 || connection.reconnectTimer) return;
  connection.reconnectTimer = setTimeout(() => {
    connection.reconnectTimer = null;
    void syncSessions(canvasId).finally(() => connect(canvasId, connection));
  }, connection.reconnectDelay);
  connection.reconnectDelay = Math.min(connection.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
}

function connect(canvasId: string, connection: CanvasConnection) {
  if (connection.clients === 0) return;
  let socket: WebSocket;
  try {
    socket = new WebSocket(agentWebSocketUrl(canvasId));
  } catch {
    scheduleReconnect(canvasId, connection);
    return;
  }
  connection.socket = socket;
  socket.onopen = () => {
    if (connection.socket !== socket) return;
    connection.reconnectDelay = 1_000;
    void syncSessions(canvasId);
  };
  socket.onmessage = (message) => {
    if (connection.socket !== socket || typeof message.data !== "string") return;
    try {
      const event: unknown = JSON.parse(message.data);
      if (!isAgentEvent(event) || (event.canvas_id !== null && event.canvas_id !== canvasId)) return;
      const store = useAgentStore.getState();
      const live = store.sessions[event.session_id]?.historyReady ?? false;
      store.handleEvent({ ...event, canvas_id: event.canvas_id ?? canvasId }, { live });
    } catch {
      socket.close();
    }
  };
  socket.onerror = () => socket.close();
  socket.onclose = () => {
    if (connection.socket !== socket) return;
    connection.socket = null;
    scheduleReconnect(canvasId, connection);
  };
}

export function startAgentCanvasEvents(canvasId: string): () => void {
  const existing = connections.get(canvasId);
  if (existing) {
    existing.clients += 1;
    return () => stopAgentCanvasEvents(canvasId, existing);
  }

  const connection: CanvasConnection = {
    clients: 1,
    socket: null,
    reconnectTimer: null,
    reconnectDelay: 1_000,
    pollTimer: null,
    polling: false,
    unsubscribe: () => undefined,
  };
  connections.set(canvasId, connection);
  const unsubscribeEvents = subscribeLiveAgentEvents((event) => {
    if (event.canvas_id !== canvasId || event.type !== "canvas.patch") return;
    const patch = event.data as unknown as CanvasPatchDto;
    if (!Array.isArray(patch.changes)) return;
    publishCanvasPatch({
      ...patch,
      canvas_id: patch.canvas_id || event.canvas_id,
      run_id: patch.run_id || event.run_id || "",
    });
  });
  let previousSignature = activeSignature(canvasId);
  const unsubscribeStore = useAgentStore.subscribe(() => {
    const nextSignature = activeSignature(canvasId);
    if (nextSignature === previousSignature) return;
    previousSignature = nextSignature;
    schedulePoll(canvasId, connection, 0);
  });
  const onVisibilityChange = () => schedulePoll(canvasId, connection, 0);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  connection.unsubscribe = () => {
    unsubscribeEvents();
    unsubscribeStore();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
  connect(canvasId, connection);
  void poll(canvasId, connection);
  return () => stopAgentCanvasEvents(canvasId, connection);
}

function stopAgentCanvasEvents(canvasId: string, connection: CanvasConnection) {
  if (connections.get(canvasId) !== connection) return;
  connection.clients = Math.max(0, connection.clients - 1);
  if (connection.clients > 0) return;
  if (connection.reconnectTimer) clearTimeout(connection.reconnectTimer);
  if (connection.pollTimer) clearTimeout(connection.pollTimer);
  connection.unsubscribe();
  connection.socket?.close();
  connection.socket = null;
  connections.delete(canvasId);
}
