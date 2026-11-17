"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, GitCommitHorizontal, Loader2, LocateFixed, Undo2 } from "lucide-react";
import type { AgentController } from "@/hooks/use-agent-controller";
import type { TimelineItem } from "@/lib/agent/timeline";
import { cn } from "@/lib/utils";
import type { NodeOption } from "./agent-editor";
import { focusAgentNodes } from "./canvas";
import { toast } from "./toast";

type Summary = Extract<TimelineItem, { type: "run-summary" }>;

export function useRunChanges(item: Summary, ctl: AgentController, nodes: NodeOption[]) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const undone = ctl.undone.has(item.runId);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const touched = [...item.created, ...item.updated];
  const rows = [...item.created.map((id) => ({ id, sign: "+", tone: "add" as const, what: byId.get(id)?.kind ?? "新建" })), ...item.updated.map((id) => ({ id, sign: "~", tone: "mod" as const, what: "已修改" })), ...item.deleted.map((entry) => ({ id: entry.id, sign: "−", tone: "del" as const, what: "已删除" }))];
  const labelOf = (id: string) => byId.get(id)?.label ?? item.deleted.find((entry) => entry.id === id)?.label ?? "已删除的节点";
  const undo = async () => { setPending(true); const result = await ctl.undo(item.runId); setPending(false); if (!result) return; setOpen(false); setSkipped(result.skipped.length); toast.success(result.skipped.length ? `已撤销 ${result.reverted} 项，${result.skipped.length} 项保持不动` : `已撤销 ${result.reverted} 项`); };
  return { item, open, setOpen, pending, skipped, undone, rows, touched, labelOf, undo, locate: (id: string) => focusAgentNodes([id]), locateAll: () => focusAgentNodes(touched, true) };
}

type Changes = ReturnType<typeof useRunChanges>;

export function ChangesPill({ changes }: { changes: Changes }) {
  const { open, setOpen, undone, rows } = changes;
  const created = rows.filter((row) => row.tone === "add").length;
  const updated = rows.filter((row) => row.tone === "mod").length;
  const deleted = rows.filter((row) => row.tone === "del").length;
  return <button type="button" aria-expanded={open} disabled={!rows.length} onClick={() => setOpen(!open)} className={cn("flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs text-zinc-500 hover:bg-zinc-100", undone && "line-through")}><GitCommitHorizontal className="size-3.5" />{undone ? "已撤销本轮" : "画布改动"}{created > 0 && <span className="font-semibold text-emerald-600">+{created}</span>}{updated > 0 && <span className="font-semibold text-blue-600">~{updated}</span>}{deleted > 0 && <span className="font-semibold text-red-600">−{deleted}</span>}<ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} /></button>;
}

export function ChangesPanel({ changes }: { changes: Changes }) {
  const { open, pending, undone, rows, labelOf, locate, locateAll, undo, skipped } = changes;
  return <AnimatePresence initial={false}>{open && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="rounded-xl border border-zinc-200 bg-zinc-50 p-2"><div className="flex max-h-44 flex-col overflow-y-auto">{rows.map((row, index) => <div key={`${row.id}-${index}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"><span className={cn("w-3 font-semibold", row.tone === "add" ? "text-emerald-600" : row.tone === "mod" ? "text-blue-600" : "text-red-600")}>{row.sign}</span><span className="min-w-0 flex-1 truncate">{labelOf(row.id)}</span><span className="text-zinc-400">{row.what}</span>{row.tone !== "del" && <button type="button" aria-label={`定位 ${labelOf(row.id)}`} onClick={() => locate(row.id)} className="grid size-6 place-items-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"><LocateFixed className="size-3.5" /></button>}</div>)}</div><div className="mt-1 flex items-center gap-1 border-t border-zinc-200 pt-1"><button type="button" disabled={!changes.touched.length} onClick={locateAll} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zinc-500 hover:bg-zinc-200 disabled:opacity-40"><LocateFixed className="size-3.5" />定位全部</button><span className="flex-1" /><button type="button" disabled={pending || undone} onClick={() => void undo()} className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-zinc-500 hover:bg-zinc-200 disabled:opacity-40">{pending ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}{undone ? "已撤销" : "撤销本轮"}</button></div>{skipped > 0 && <p className="px-2 pt-1 text-[11px] text-amber-600">{skipped} 项因之后被修改而保留</p>}</div></motion.div>}</AnimatePresence>;
}

