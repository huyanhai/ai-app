import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge } from "@xyflow/react";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import type { TAllNodes } from "../types";
import { useCanvasId } from "../canvas-workspace-context";

export type ProductionProject = {
  id: string;
  idea: string;
  status: string;
  mediaMode?: "auto" | "manual";
  error?: string;
  requirements?: { status: "ready" | "questions"; brief: string; questions: string[] } | null;
  events: { id: string; stage: string; message: string; createdAt: string }[];
  plan: {
    title: string;
    synopsis: string;
    story: string;
    characters: { id: string; name: string; description: string }[];
    scenes: { id: string; title: string; script: string; location: string; shots?: { id: string; title: string; description: string; movement: string; visualPrompt?: string; motionPrompt?: string; duration: number }[] }[];
  };
  nodes: TAllNodes[];
  edges: Edge[];
};

export type ProductionStreamPreview = { stage: string; data?: unknown };

type ProductionHookOptions = {
  getGraph: () => { nodes: TAllNodes[]; edges: Edge[] };
  applyGraph: (nodes: TAllNodes[], edges: Edge[], replace?: boolean) => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}/productions${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "制作项目请求失败");
  return data as T;
};

const streamRequest = async (
  path: string,
  init: RequestInit,
  onPreview: (preview: ProductionStreamPreview) => void,
): Promise<ProductionProject> => {
  const response = await fetch(`${API_BASE}/productions${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "制作项目请求失败");
  }
  if (!response.body) throw new Error("浏览器不支持流式响应");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ProductionProject | null = null;
  const consume = (block: string) => {
    const line = block.split("\n").find((item) => item.startsWith("data: "));
    if (!line) return;
    const event = JSON.parse(line.slice(6));
    if (event.type === "start" || event.type === "chunk") {
      onPreview({ stage: event.stage, data: event.data });
    } else if (event.type === "result") {
      result = event.project;
    } else if (event.type === "error") {
      throw new Error(event.error || "制作项目生成失败");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    blocks.forEach(consume);
    if (done) break;
  }
  if (buffer.trim()) consume(buffer);
  if (!result) throw new Error("流式响应未返回制作结果");
  return result;
};

export const useProduction = ({ getGraph, applyGraph }: ProductionHookOptions) => {
  const canvasId = useCanvasId();
  const activeProjectKey = `active-production-id:${canvasId}`;
  const [project, setProject] = useState<ProductionProject | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState("");
  const [streamPreview, setStreamPreview] = useState<ProductionStreamPreview | null>(null);
  const restoredRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const resumedStageRef = useRef("");

  const applyProject = useCallback((next: ProductionProject, replace = false, syncCanvas = true) => {
    setProject(next);
    window.localStorage.setItem(activeProjectKey, next.id);
    if (!syncCanvas) return;
    if (replace) {
      applyGraph(next.nodes, next.edges, true);
      return;
    }
    const current = getGraph();
    const remoteNodes = new Map(next.nodes.map((node) => [node.id, node]));
    const mergedNodes = current.nodes.map((node) => {
      const remote = remoteNodes.get(node.id);
      if (!remote) return node;
      if (
        node.data.production &&
        "url" in node.data &&
        node.data.url &&
        node.data.status === ChunkStatus.SUCCESS &&
        "url" in remote.data &&
        !remote.data.url
      ) {
        return {
          ...node,
          data: {
            ...remote.data,
            url: node.data.url,
            status: ChunkStatus.SUCCESS,
            error: undefined,
          },
        };
      }
      return { ...node, data: remote.data };
    });
    const currentNodeIds = new Set(current.nodes.map((node) => node.id));
    const currentEdgeIds = new Set(current.edges.map((edge) => edge.id));
    applyGraph([
      ...mergedNodes,
      ...next.nodes.filter((node) => !currentNodeIds.has(node.id)),
    ], [
      ...current.edges,
      ...next.edges.filter((edge) => !currentEdgeIds.has(edge.id)),
    ], false);
  }, [activeProjectKey, applyGraph, getGraph]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const projectId = window.localStorage.getItem(activeProjectKey) ??
      (canvasId === "default" ? window.localStorage.getItem("active-production-id") : null);
    if (!projectId) return;
    void request<ProductionProject>(`/${projectId}`)
      .then((next) => applyProject(next, false, false))
      .catch(() => window.localStorage.removeItem(activeProjectKey));
  }, [activeProjectKey, applyProject, canvasId]);

  const plan = useCallback(async (idea: string, modelId: string, style?: string) => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setIsPlanning(true);
    setError("");
    setStreamPreview({ stage: "requirements" });
    try {
      const next = await streamRequest("/plan/stream", {
        method: "POST",
        body: JSON.stringify({ idea, modelId, style }),
        signal: controller.signal,
      }, setStreamPreview);
      applyProject(next);
    } catch (cause) {
      if (controller.signal.aborted) setError("已停止生成");
      else setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsPlanning(false);
      setStreamPreview(null);
    }
  }, [applyProject]);

  const confirmStage = useCallback(async (mediaMode?: "auto" | "manual", continuity = false) => {
    if (!project) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setIsAdvancing(true);
    setError("");
    setStreamPreview(null);
    try {
      const next = await streamRequest(`/${project.id}/confirm-stage/stream`, {
        method: "POST",
        body: JSON.stringify({ ...getGraph(), mediaMode, continuity }),
        signal: controller.signal,
      }, setStreamPreview);
      applyProject(next);
    } catch (cause) {
      if (controller.signal.aborted) setError("已停止生成");
      else setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsAdvancing(false);
      setStreamPreview(null);
    }
  }, [applyProject, getGraph, project]);

  useEffect(() => {
    if (!project || isPlanning || isAdvancing) return;
    const resumable = ["script_pending", "characters_pending", "storyboard_pending", "image_prompts_pending", "video_prompts_pending"];
    if (!resumable.includes(project.status)) return;
    const resumeKey = `${project.id}:${project.status}`;
    if (resumedStageRef.current === resumeKey) return;
    resumedStageRef.current = resumeKey;
    void confirmStage();
  }, [confirmStage, isAdvancing, isPlanning, project]);

  const reviseStage = useCallback(async (stage: "requirements" | "script" | "characters" | "storyboard" | "imagePrompts" | "videoPrompts", feedback: string) => {
    if (!project) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setIsAdvancing(true);
    setError("");
    setStreamPreview({ stage });
    const displayFeedback = stage === "requirements" && feedback.startsWith("我授权你根据已知需求自动补充")
      ? "让 Agent 帮我补充"
      : feedback;
    setProject((current) => current ? {
      ...current,
      events: [...current.events, {
        id: `local-${Date.now()}`,
        stage,
        message: `用户修改意见：${displayFeedback}`,
        createdAt: new Date().toISOString(),
      }],
    } : current);
    try {
      const next = await streamRequest(`/${project.id}/revise-stage/stream`, {
        method: "POST",
        body: JSON.stringify({ ...getGraph(), stage, feedback }),
        signal: controller.signal,
      }, setStreamPreview);
      applyProject(next, true);
    } catch (cause) {
      if (controller.signal.aborted) setError("已停止生成");
      else setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsAdvancing(false);
      setStreamPreview(null);
    }
  }, [applyProject, getGraph, project]);

  const confirm = useCallback(async () => {
    if (!project) return;
    setError("");
    try {
      const next = await request<ProductionProject>(`/${project.id}/confirm`, {
        method: "POST",
        body: JSON.stringify(getGraph()),
      });
      applyProject(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [applyProject, getGraph, project]);

  const startPhase = useCallback(async (phase: "references" | "storyboards" | "videos") => {
    if (!project) return;
    setError("");
    try {
      const next = await request<ProductionProject>(`/${project.id}/media-phase`, {
        method: "POST",
        body: JSON.stringify({ phase }),
      });
      applyProject(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [applyProject, project]);

  const pause = useCallback(async () => {
    if (!project) return;
    const next = await request<ProductionProject>(`/${project.id}/pause`, { method: "POST" });
    setProject(next);
  }, [project]);

  const retry = useCallback(async (nodeId: string, independent = false) => {
    if (!project) return;
    setError("");
    try {
      const next = await request<ProductionProject>(`/${project.id}/nodes/${nodeId}/retry`, {
        method: "POST",
        body: JSON.stringify({ independent }),
      });
      applyProject(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [applyProject, project]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    window.localStorage.removeItem(activeProjectKey);
    setProject(null);
    setIsPlanning(false);
    setIsAdvancing(false);
    setStreamPreview(null);
    setError("");
  }, [activeProjectKey]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsPlanning(false);
    setIsAdvancing(false);
    setStreamPreview(null);
  }, []);

  useEffect(() => {
    if (!project?.status.endsWith("_running")) return;
    const projectId = project.id;
    const timer = window.setInterval(() => {
      void request<ProductionProject>(`/${projectId}`)
        .then((next) => applyProject(next))
        .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [applyProject, project?.id, project?.status]);

  return { project, isPlanning, isAdvancing, streamPreview, error, plan, confirmStage, reviseStage, confirm, startPhase, pause, retry, reset, stop };
};
