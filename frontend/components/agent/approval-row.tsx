"use client";

import { Check, CornerDownRight, FilePen, Hand, MessageCircleQuestion, Sparkles, Trash2 } from "lucide-react";
import type { AgentController } from "@/hooks/use-agent-controller";
import { askAnsweredRows } from "@/lib/agent/ask";
import { approvalTitle } from "./approval-title";

export { approvalTitle, deletePayload } from "./approval-title";

export function ApprovalRow({ approvalId, ctl }: { approvalId: string; ctl: AgentController }) {
  const approval = ctl.state.approvals[approvalId];
  if (!approval) return null;
  if (approval.status === "pending" && ctl.pending?.id === approval.id) return null;
  const pending = approval.status === "pending";
  const ask = approval.kind === "ask";
  const rejected = approval.status === "rejected";
  const Icon = pending ? Hand : ask ? MessageCircleQuestion : approval.kind === "generate" ? Sparkles : approval.kind === "delete" ? Trash2 : FilePen;
  const answer = typeof approval.decision?.answer === "string" ? approval.decision.answer : "";
  const rows = ask && !rejected ? askAnsweredRows(approval) : [];
  const status = pending ? "等待处理" : rejected ? "已拒绝" : approval.status === "expired" ? "已过期" : approval.status === "failed" ? "执行失败" : "已完成";
  return <div className="flex items-start gap-2 text-xs text-zinc-500"><Icon className="mt-0.5 size-3.5 shrink-0" /><div className="min-w-0 flex-1"><p className="break-words"><span className="text-zinc-700">{approvalTitle(approval)}</span><span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap">{!pending && !ask && <Check className="size-3 text-emerald-600" />}{status}</span></p>{answer && rejected && <p className="mt-0.5 text-zinc-400">{answer}</p>}{rows.map((row, index) => <p key={index} className="mt-0.5 flex gap-1"><CornerDownRight className="mt-0.5 size-3 shrink-0" /><span>{row.question}：{row.answer || "未回答"}</span></p>)}{rejected && ask && !answer && <p className="mt-0.5 flex items-center gap-1"><CornerDownRight className="size-3" />跳过了这个问题</p>}</div></div>;
}

