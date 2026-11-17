import type { CanvasPatchDto } from "@/api/agent/type";
import { subscribeLiveAgentEvents, useAgentStore } from "@/store/agent";
import { publishCanvasPatch } from "./patch-bus";
import { activeRunId } from "./session-state";

const ACTIVE_INTERVAL_MS = 1_000;
const IDLE_INTERVAL_MS = 5_000;
const BACKGROUND_INTERVAL_MS = 15_000;

type CanvasPoller = {
  clients: number;
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  unsubscribe: () => void;
};

const pollers = new Map<string, CanvasPoller>();

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

function pollDelay(canvasId: string): number {
  if (typeof document !== "undefined" && document.hidden) return BACKGROUND_INTERVAL_MS;
  return activeSignature(canvasId) ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
}

function schedule(canvasId: string, poller: CanvasPoller, delay = pollDelay(canvasId)) {
  if (poller.clients === 0) return;
  if (poller.timer) clearTimeout(poller.timer);
  poller.timer = setTimeout(() => {
    poller.timer = null;
    void poll(canvasId, poller);
  }, delay);
}

async function poll(canvasId: string, poller: CanvasPoller) {
  if (poller.running || poller.clients === 0) return;
  poller.running = true;
  try {
    const store = useAgentStore.getState();
    await Promise.allSettled(loadedSessionIds(canvasId).map((id) => store.sync(id)));
  } finally {
    poller.running = false;
    schedule(canvasId, poller);
  }
}

export function startAgentCanvasPolling(canvasId: string): () => void {
  let poller = pollers.get(canvasId);
  if (poller) {
    poller.clients += 1;
    return () => stopAgentCanvasPolling(canvasId, poller!);
  }

  poller = { clients: 1, timer: null, running: false, unsubscribe: () => undefined };
  pollers.set(canvasId, poller);
  const active = poller;
  let previousSignature = activeSignature(canvasId);
  active.unsubscribe = useAgentStore.subscribe(() => {
    const nextSignature = activeSignature(canvasId);
    if (nextSignature === previousSignature) return;
    previousSignature = nextSignature;
    schedule(canvasId, active, 0);
  });
  const onVisibilityChange = () => schedule(canvasId, active, 0);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  const originalUnsubscribe = active.unsubscribe;
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
  active.unsubscribe = () => {
    originalUnsubscribe();
    unsubscribeEvents();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
  void poll(canvasId, active);
  return () => stopAgentCanvasPolling(canvasId, active);
}

function stopAgentCanvasPolling(canvasId: string, poller: CanvasPoller) {
  if (pollers.get(canvasId) !== poller) return;
  poller.clients = Math.max(0, poller.clients - 1);
  if (poller.clients > 0) return;
  if (poller.timer) clearTimeout(poller.timer);
  poller.unsubscribe();
  pollers.delete(canvasId);
}
