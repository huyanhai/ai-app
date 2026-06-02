import { StreamEvent } from "backend/src/common/utils/ai-stream-utils";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export function parseSseLine(line: string): Record<string, unknown> | null {
  const cleaned = line.trim();
  if (!cleaned.startsWith("data:")) return null;
  const jsonStr = cleaned.slice(5).trim();
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// 封装流式数据处理接口
export const sseFetch = async ({
  url,
  body,
  abortController,
  cb,
}: {
  url: string;
  body: string;
  abortController: AbortController;
  cb: (data: StreamEvent) => void;
}) => {
  const response = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: abortController.signal,
    body,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseSseLine(line);
      if (!event) continue;

      cb(event as StreamEvent);
    }
  }
};
