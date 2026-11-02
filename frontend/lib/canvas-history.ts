import { Edge } from "@xyflow/react";
import { NodeType, TAllNodes } from "@/components/pipeline/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export type CanvasSnapshot = {
  nodes: TAllNodes[];
  edges: Edge[];
};

export type StoredCanvas = CanvasSnapshot & {
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
};

export type GenerationRecord = {
  id: string;
  nodeId: string;
  nodeType: NodeType;
  title: string;
  model?: string;
  url: string;
  createdAt: string;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}/canvas${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error("画布历史请求失败");
  return response.json() as Promise<T>;
};

const uploadCache = new Map<string, Promise<string>>();

const uploadAsset = (dataUrl: string) => {
  const cached = uploadCache.get(dataUrl);
  if (cached) return cached;
  const uploading = request<{ url: string }>("/assets", {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  }).then((result) => result.url).catch((error) => {
    uploadCache.delete(dataUrl);
    throw error;
  });
  uploadCache.set(dataUrl, uploading);
  return uploading;
};

const ensureMp4 = async (url: string) => {
  if (!/\.webm(?:$|[?#])/i.test(url)) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error("无法读取需要转码的预演视频");
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("无法读取需要转码的预演视频"));
    reader.readAsDataURL(blob);
  });
  return uploadAsset(dataUrl.replace(/^data:[^;]+/, "data:video/webm"));
};

const externalizeAssets = async <T>(value: T): Promise<T> => {
  if (typeof value === "string" && value.startsWith("data:image/")) {
    return await uploadAsset(value) as T;
  }
  if (Array.isArray(value)) {
    return await Promise.all(value.map((item) => externalizeAssets(item))) as T;
  }
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [
      key,
      await externalizeAssets(item),
    ]));
    return Object.fromEntries(entries) as T;
  }
  return value;
};

export const canvasHistoryApi = {
  uploadAsset: (dataUrl: string) => uploadAsset(dataUrl),
  ensureMp4,
  load: () => request<StoredCanvas | null>(""),
  save: async (snapshot: StoredCanvas) => {
    const externalized = await externalizeAssets(snapshot);
    return request<{ success: boolean }>("", {
      method: "PUT",
      body: JSON.stringify(externalized),
    });
  },
  generations: () => request<GenerationRecord[]>("/generations"),
  recordGeneration: async (record: Omit<GenerationRecord, "id" | "createdAt">) => {
    const externalized = await externalizeAssets(record);
    return request<GenerationRecord>("/generations", {
      method: "POST",
      body: JSON.stringify(externalized),
    }).then((created) => {
      window.dispatchEvent(new Event("canvas-generation-recorded"));
      return created;
    });
  },
};
