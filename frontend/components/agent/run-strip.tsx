"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronUp, X } from "lucide-react";
import type { RunStrip as RunStripModel } from "@/lib/agent/timeline";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./progress-ring";

export function RunStrip({ strip, onHide }: { strip: RunStripModel; onHide: (runId: string) => void }) {
  const [open, setOpen] = useState(false);
  const { done, total } = strip.progress;
  const finished = total > 0 && done === total;
  return <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-b border-zinc-200/70">
    <AnimatePresence initial={false}>{open && <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="max-h-48 overflow-y-auto px-3 pt-2 text-xs">{strip.steps.map((step, index) => <li key={`${step.title}-${index}`} className={cn("flex h-7 items-center gap-2.5", step.status === "todo" && "text-zinc-400", step.status === "done" && "text-zinc-400 line-through", step.status === "doing" && "font-medium")}><span className="grid size-3.5 place-items-center">{step.status === "done" ? <Check className="size-3.5 text-emerald-600" /> : <span className={cn("size-[7px] rounded-full border-[1.5px] border-current", step.status === "doing" && "border-amber-500 bg-amber-500")} />}</span><span className="truncate">{step.title}</span></li>)}</motion.ul>}</AnimatePresence>
    <div className="flex h-10 items-center gap-2 pl-3 pr-1.5 text-xs"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><ProgressRing value={done} total={total} className={finished ? "stroke-emerald-500" : "stroke-amber-500"} />{finished ? <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">完成</span> : strip.unfinished && <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">未完成</span>}<span className="min-w-0 flex-1 truncate">{finished ? "全部步骤已完成" : strip.current}</span><span className="shrink-0 text-zinc-500 tabular-nums">{done}/{total}</span><ChevronUp className={cn("size-3.5 text-zinc-400 transition-transform", open && "rotate-180")} /></button>{strip.unfinished && <button type="button" aria-label="隐藏这个计划" onClick={() => onHide(strip.runId)} className="grid size-7 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X className="size-3.5" /></button>}</div>
  </motion.div>;
}

