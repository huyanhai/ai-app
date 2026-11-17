import { agentRequest, agentUrl, unwrapAgentResponse } from "@/lib/agent/http";
import type {
  AgentApprovalDto,
  AgentAttachmentReq,
  AgentEventDto,
  AgentFeedbackDto,
  AgentHistoryDto,
  AgentModelDto,
  AgentRunDto,
  AgentSessionDto,
  AgentUndoResult,
  AgentWatchBatchDto,
  CreateAdminAssistantSessionReq,
  CreateAgentSessionReq,
  DecideAgentApprovalReq,
  SetAgentFeedbackReq,
  StartAgentRunReq,
} from "./type";

export const getAgentModels = async (): Promise<AgentModelDto[]> =>
  (await agentRequest<AgentModelDto[] | null>("/models")) ?? [];

export const listAgentSessions = async (canvasId: string): Promise<AgentSessionDto[]> =>
  (await agentRequest<AgentSessionDto[] | null>(`/canvas/${encodeURIComponent(canvasId)}/agent/sessions`)) ?? [];

export const createAgentSession = (canvasId: string, data: CreateAgentSessionReq) =>
  agentRequest<AgentSessionDto>(`/canvas/${encodeURIComponent(canvasId)}/agent/sessions`, {
    method: "POST",
    body: data,
  });

export const listAdminAssistantSessions = async (): Promise<AgentSessionDto[]> =>
  (await agentRequest<AgentSessionDto[] | null>("/admin/assistant/sessions")) ?? [];

export const createAdminAssistantSession = (data: CreateAdminAssistantSessionReq) =>
  agentRequest<AgentSessionDto>("/admin/assistant/sessions", { method: "POST", body: data });

export const renameAgentSession = (sessionId: string, title: string) =>
  agentRequest<void>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: { title },
  });

export const deleteAgentSession = (sessionId: string) =>
  agentRequest<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });

export const getAgentEvents = async (sessionId: string, after: number): Promise<AgentEventDto[]> =>
  (await agentRequest<AgentEventDto[] | null>(`/sessions/${encodeURIComponent(sessionId)}/events`, {
    query: { after },
  })) ?? [];

export const getAgentHistory = async (
  sessionId: string,
  before: number,
): Promise<AgentHistoryDto> => {
  const page = await agentRequest<AgentHistoryDto | null>(
    `/sessions/${encodeURIComponent(sessionId)}/history`,
    { query: { before } },
  );
  return { events: page?.events ?? [], has_more: page?.has_more ?? false };
};

export const startAgentRun = (sessionId: string, data: StartAgentRunReq) =>
  agentRequest<AgentRunDto>(`/sessions/${encodeURIComponent(sessionId)}/runs`, {
    method: "POST",
    body: data,
  });

export const interjectAgentRun = (
  runId: string,
  message: string,
  attachments?: AgentAttachmentReq[],
) =>
  agentRequest<void>(`/runs/${encodeURIComponent(runId)}/interject`, {
    method: "POST",
    body: { message, ...(attachments?.length && { attachments }) },
  });

export const cancelAgentRun = (runId: string) =>
  agentRequest<AgentRunDto>(`/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });

export const resumeAgentRun = (runId: string) =>
  agentRequest<AgentRunDto>(`/runs/${encodeURIComponent(runId)}/resume`, {
    method: "POST",
  });

export const undoAgentRun = (runId: string) =>
  agentRequest<AgentUndoResult>(`/runs/${encodeURIComponent(runId)}/undo`, { method: "POST" });

export const decideAgentApproval = (approvalId: string, data: DecideAgentApprovalReq) =>
  agentRequest<AgentApprovalDto>(`/approvals/${encodeURIComponent(approvalId)}/decision`, {
    method: "POST",
    body: data,
  });

export const setAgentFeedback = async (
  runId: string,
  data: SetAgentFeedbackReq,
): Promise<AgentFeedbackDto> => {
  const saved = await agentRequest<AgentFeedbackDto>(
    `/runs/${encodeURIComponent(runId)}/feedback`,
    { method: "PUT", body: data },
  );
  return { ...saved, reasons: saved.reasons ?? [], comment: saved.comment ?? "" };
};

export const deleteAgentFeedback = (runId: string) =>
  agentRequest<void>(`/runs/${encodeURIComponent(runId)}/feedback`, { method: "DELETE" });

export const getAgentWatches = async (sessionId: string): Promise<AgentWatchBatchDto[]> =>
  (
    await agentRequest<{ items: AgentWatchBatchDto[] | null } | null>(
      `/sessions/${encodeURIComponent(sessionId)}/watches`,
    )
  )?.items ?? [];

export const cancelAgentWatches = async (sessionId: string): Promise<AgentWatchBatchDto[]> =>
  (
    await agentRequest<{ items: AgentWatchBatchDto[] | null } | null>(
      `/sessions/${encodeURIComponent(sessionId)}/watches/cancel`,
      { method: "POST" },
    )
  )?.items ?? [];

export type AgentUploadedAsset = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  mimeType: string;
};

export function uploadAgentAsset(
  file: File,
  options: { signal?: AbortSignal; onProgress?: (percent: number) => void } = {},
): Promise<AgentUploadedAsset> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new DOMException("上传已取消", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", agentUrl("/assets"));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(Math.floor((event.loaded / event.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error("附件上传失败"));
    xhr.onabort = () => reject(new DOMException("上传已取消", "AbortError"));
    xhr.onload = () => {
      try {
        const parsed: unknown = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        const raw = unwrapAgentResponse<Record<string, unknown>>(parsed, xhr.status);
        if (xhr.status < 200 || xhr.status >= 300 || !raw) throw new Error("附件上传失败");
        const id = raw.id ?? raw.asset_id;
        if ((typeof id !== "string" && typeof id !== "number") || typeof raw.url !== "string") {
          throw new Error("附件上传响应不完整");
        }
        resolve({
          id: String(id),
          url: raw.url,
          width: typeof raw.width === "number" && raw.width > 0 ? raw.width : null,
          height: typeof raw.height === "number" && raw.height > 0 ? raw.height : null,
          mimeType: String(raw.mime_type ?? raw.mimeType ?? file.type),
        });
      } catch (error) {
        reject(error);
      }
    };
    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}
