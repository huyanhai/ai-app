"use client";

import { useState } from "react";
import { Check, Loader2, MessageCircleQuestion, Sparkles, Trash2, X } from "lucide-react";
import type { AgentApprovalDto, AgentAskPayload, AgentEditPayload, AgentGeneratePayload, DecideAgentApprovalReq } from "@/api/agent/type";
import type { AgentController } from "@/hooks/use-agent-controller";
import { askQuestions, buildAskDecision, emptyDraft, isQuickAsk, type AskDraft } from "@/lib/agent/ask";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AskForm } from "./ask-form";
import { approvalTitle, deletePayload } from "./approval-title";

export function ApprovalCard({ approval, ctl }: { approval: AgentApprovalDto; ctl: AgentController }) {
  if (approval.kind === "ask" && !isQuickAsk(askQuestions(approval.payload as AgentAskPayload))) return <AskForm key={approval.id} approval={approval} ctl={ctl} />;
  return <DecisionCard approval={approval} ctl={ctl} />;
}

function DecisionCard({ approval, ctl }: { approval: AgentApprovalDto; ctl: AgentController }) {
  const generate = approval.kind === "generate" ? approval.payload as AgentGeneratePayload : null;
  const remove = approval.kind === "delete" ? deletePayload(approval.payload) : null;
  const ask = approval.kind === "ask" ? approval.payload as AgentAskPayload : null;
  const edit = !generate && !remove && !ask ? approval.payload as AgentEditPayload : null;
  const items = generate?.items.length ?? remove?.node_ids.length ?? 0;
  const [picks, setPicks] = useState(() => Array.from({ length: items }, () => true));
  const [counts, setCounts] = useState(() => generate?.items.map((item) => item.count) ?? []);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const decide = async (request: DecideAgentApprovalReq) => { setBusy(true); await ctl.decide(approval.id, request); setBusy(false); };
  const quick = ask ? askQuestions(ask)[0] : null;
  const quickChoices = quick?.kind === "model" ? (quick.models ?? []).map((model) => ({ key: model.key, label: model.name, hint: model.hint })) : (quick?.options ?? []).map((option) => ({ key: option.label, label: option.label, hint: "" }));
  const quickAnswer = (value: string) => {
    if (!quick) return;
    const draft: AskDraft = { ...emptyDraft(), picked: [value] };
    void decide(buildAskDecision([quick], { [quick.id]: draft }));
  };
  const title = approvalTitle(approval);
  const destructive = !!remove;
  return <section aria-label={title} className={cn("flex flex-col gap-3 rounded-xl border bg-[#1c1c1e] p-3 shadow-sm", destructive ? "border-red-400/40" : "border-[#33a3ff]/40")}>
    <header className="flex items-start gap-2 text-[13px] font-medium">{generate ? <Sparkles className="mt-0.5 size-4 shrink-0 text-[#33a3ff]" /> : remove ? <Trash2 className="mt-0.5 size-4 shrink-0 text-red-500" /> : <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-[#33a3ff]" />}<span className="min-w-0 flex-1">{title}</span></header>
    {generate && <><p className="text-xs leading-relaxed text-zinc-500">{generate.reason}</p><div className="flex flex-col gap-1">{generate.items.map((item, index) => <div key={item.node_id} className={cn("flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs", !picks[index] && "opacity-50")}><input type="checkbox" aria-label={`批准 ${item.label}`} checked={picks[index]} onChange={() => setPicks((current) => current.map((value, position) => position === index ? !value : value))} className="accent-zinc-900" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.label}</span><span className="block truncate text-[11px] text-zinc-500">{item.model_name}</span></span><label className="flex items-center gap-1 text-zinc-500">数量<input type="number" min={1} max={item.count} value={counts[index]} disabled={!picks[index]} onChange={(event) => setCounts((current) => current.map((value, position) => position === index ? Math.max(1, Math.min(item.count, Number(event.target.value) || 1)) : value))} className="h-6 w-12 rounded border border-zinc-200 text-center" /></label></div>)}</div></>}
    {remove && <><p className="text-xs text-zinc-500">{remove.reason}</p><div className="flex flex-col gap-1">{remove.node_ids.map((id, index) => <label key={id} className={cn("flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs", !picks[index] && "opacity-50")}><input type="checkbox" checked={picks[index]} onChange={() => setPicks((current) => current.map((value, position) => position === index ? !value : value))} className="accent-zinc-900" /><span className="min-w-0 flex-1 truncate">{remove.labels[index] || id}</span>{remove.outputs[index] && <span className="text-red-600">含生成结果</span>}</label>)}{remove.edge_ids.length > 0 && <p className="text-[11px] text-zinc-500">同时删除 {remove.edge_ids.length} 条相关连线</p>}</div></>}
    {edit && <><p className="text-xs text-zinc-500">{edit.reason}</p>{(edit.before || edit.after) && <div className="flex max-h-44 flex-col gap-1 overflow-y-auto text-xs">{edit.before && <p className="whitespace-pre-wrap rounded-lg bg-red-50 p-2"><span className="mr-2 font-medium text-red-600">修改前</span>{edit.before}</p>}{edit.after && <p className="whitespace-pre-wrap rounded-lg bg-emerald-50 p-2"><span className="mr-2 font-medium text-emerald-600">修改后</span>{edit.after}</p>}</div>}</>}
    {quick && <div className="flex flex-col gap-1">{quickChoices.map((choice, index) => <button key={choice.key} type="button" disabled={busy} onClick={() => quickAnswer(choice.key)} className="flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-2 text-left text-[13px] hover:bg-zinc-50"><span className="grid size-[18px] place-items-center rounded bg-zinc-100 text-[11px]">{String.fromCharCode(65 + index)}</span><span>{choice.label}</span><span className="text-xs text-zinc-400">{choice.hint}</span></button>)}{quick.allow_custom && <div className="flex gap-1"><input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="其他，我来说" className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 px-2.5 text-xs outline-none focus:border-blue-400" /><Button type="button" size="sm" disabled={!custom.trim() || busy} onClick={() => { const draft: AskDraft = { ...emptyDraft(), custom: custom.trim(), picked: ["\u0000custom"] }; void decide(buildAskDecision([quick], { [quick.id]: draft })); }}>回答</Button></div>}</div>}
    {rejecting && <textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} placeholder="告诉 Agent 怎么改（可留空）" className="min-h-16 rounded-lg border border-zinc-200 p-2 text-xs outline-none focus:border-blue-400" />}
    {!quick && <div className="flex flex-wrap items-center justify-end gap-2"><button type="button" disabled={busy} onClick={() => rejecting ? void decide({ decision: "reject", answer: reason.trim() }) : setRejecting(true)} className="mr-auto text-xs text-zinc-500 hover:text-zinc-800">{rejecting ? "确认拒绝" : "拒绝，并告诉 Agent 怎么改"}</button>{rejecting && <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}><X />取消</Button>}<Button type="button" size="sm" variant={destructive ? "destructive" : "default"} disabled={busy || (items > 0 && !picks.some(Boolean))} onClick={() => void decide({ decision: "approve", ...(items > 0 && { items: picks.map((approve, index) => ({ index, approve, ...(generate && { count: counts[index] }) })) }) })}>{busy ? <Loader2 className="animate-spin" /> : <Check />}{generate ? "批准生成" : remove ? "批准删除" : "确认修改"}</Button></div>}
    {quick && <button type="button" disabled={busy} onClick={() => void decide({ decision: "reject" })} className="self-start text-xs text-zinc-500 hover:text-zinc-800">跳过这个问题</button>}
  </section>;
}

