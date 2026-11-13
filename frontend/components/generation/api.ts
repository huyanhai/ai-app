import { sseFetch } from "@/lib/sse";
import type { StreamEvent } from "backend/src/common/utils/ai-stream-utils";
import type { GenerationInput, GenerationJob } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message ?? "生成记录请求失败");
  return body as T;
};

export const createGeneration = (input: GenerationInput) => request<GenerationJob>("/generations", {
  method: "POST",
  body: JSON.stringify(input),
});

export const getGeneration = (id: string) => request<GenerationJob>(`/generations/${id}`);

export const uploadGenerationAsset = async (dataUrl: string) => {
  const result = await request<{ url: string }>("/canvas/assets", {
    method: "POST",
    body: JSON.stringify({ dataUrl }),
  });
  return result.url;
};

export const runGeneration = (id: string, abortController: AbortController, cb: (event: StreamEvent) => void) => sseFetch({
  url: `/generations/${id}/run`,
  body: "{}",
  abortController,
  cb,
});

export const generationMediaUrl = (url: string) => url.startsWith("/") ? `${API_BASE}${url}` : url;
