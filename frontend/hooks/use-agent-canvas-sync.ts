import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { canvasHistoryApi } from "@/lib/canvas-history";
import { createAgentSync } from "@/lib/agent/canvas-sync";
import {
  unflatten,
  type MergeEdge,
  type MergeGraph,
  type MergeNode,
  type MergeOptions,
} from "@/lib/agent/graph-changes";
import { subscribeCanvasPatch } from "@/lib/agent/patch-bus";
import { startAgentCanvasEvents } from "@/lib/agent/websocket";
import { activeRunId } from "@/lib/agent/session-state";
import { useAgentStore } from "@/store/agent";
import { useAgentHighlight } from "@/store/agent-highlight";

export type AgentCanvasSyncArgs<N extends MergeNode, E extends MergeEdge> = {
  canvas: { id: string; graph: MergeGraph<N, E>; version: number };
  getVersion: () => number;
  mergeVersion: (version: number) => void;
  hasUnsaved: () => boolean;
  nodesRef: RefObject<N[]>;
  edgesRef: RefObject<E[]>;
  setNodes: Dispatch<SetStateAction<N[]>>;
  setEdges: Dispatch<SetStateAction<E[]>>;
  skipNextSave: () => void;
  markTasksKnown: (ids: string[]) => void;
  resetHistory: () => void;
  merge?: Pick<MergeOptions<N, E>, "makeNode" | "makeEdge" | "normalize">;
};

export function useAgentCanvasSync<N extends MergeNode, E extends MergeEdge>(
  args: AgentCanvasSyncArgs<N, E>,
) {
  const [sync] = useState(() =>
    createAgentSync<N, E>({
      initial: { graph: args.canvas.graph, version: args.canvas.version },
      fetchLatest: async () => {
        const latest = await canvasHistoryApi.load(args.canvas.id);
        if (!latest) throw new Error("画布不存在");
        return {
          graph: {
            nodes: latest.nodes as unknown as N[],
            edges: latest.edges as unknown as E[],
          },
          version: latest.revision ?? args.getVersion(),
        };
      },
      getVersion: args.getVersion,
      mergeVersion: args.mergeVersion,
      hasUnsaved: args.hasUnsaved,
      getLocal: () => ({ nodes: args.nodesRef.current, edges: args.edgesRef.current }),
      setLocal: (graph, { quiet, taskIds, touchedIds }) => {
        args.nodesRef.current = graph.nodes;
        args.edgesRef.current = graph.edges;
        if (quiet) args.skipNextSave();
        args.markTasksKnown(taskIds);
        args.setNodes(graph.nodes);
        args.setEdges(graph.edges);
        args.resetHistory();
        useAgentHighlight.getState().touch(touchedIds);
      },
      isAgentActive: () => {
        const { sessionsByCanvas, sessions } = useAgentStore.getState();
        return (sessionsByCanvas[args.canvas.id] ?? []).some(
          (session) => sessions[session.id] && activeRunId(sessions[session.id]) !== null,
        );
      },
      merge: args.merge ?? {
        makeNode: (fields) => unflatten(fields) as N,
        makeEdge: (fields) => fields as E,
      },
    }),
  );

  useEffect(
    () => subscribeCanvasPatch(args.canvas.id, (patch) => void sync.handlePatch(patch)),
    [args.canvas.id, sync],
  );

  useEffect(() => startAgentCanvasEvents(args.canvas.id), [args.canvas.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void sync.refresh().catch(() => undefined);
    }, 1000);
    const refresh = () => void sync.refresh(true).catch(() => undefined);
    window.addEventListener("agent:canvas-refresh", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("agent:canvas-refresh", refresh);
    };
  }, [sync]);

  return sync;
}
