import type { AgentApprovalDto, AgentAskPayload, AgentDeletePayload, AgentEditPayload, AgentGeneratePayload } from "@/api/agent/type";

export function deletePayload(raw: unknown): AgentDeletePayload {
  const value = raw as Partial<AgentDeletePayload>;
  return { reason: typeof value.reason === "string" ? value.reason : "", node_ids: Array.isArray(value.node_ids) ? value.node_ids : [], labels: Array.isArray(value.labels) ? value.labels : [], outputs: Array.isArray(value.outputs) ? value.outputs : [], edge_ids: Array.isArray(value.edge_ids) ? value.edge_ids : [] };
}

export function approvalTitle(approval: AgentApprovalDto) {
  if (approval.kind === "generate") return `申请生成 ${(approval.payload as AgentGeneratePayload).items?.length ?? 0} 项内容`;
  if (approval.kind === "delete") return `申请删除 ${deletePayload(approval.payload).node_ids.length} 个节点`;
  if (approval.kind === "ask") return (approval.payload as AgentAskPayload).question;
  const payload = approval.payload as AgentEditPayload;
  return payload.title || "确认修改";
}

