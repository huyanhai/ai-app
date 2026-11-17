"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WatchSummary } from "@/lib/agent/watch";
import { ProgressRing } from "./progress-ring";
import { focusAgentNodes } from "./canvas";

export function WatchStrip({ summary, onCancel }: { summary: WatchSummary; onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return <div className="mx-3 mb-1.5 shrink-0 rounded-xl border border-zinc-200/80 bg-zinc-50 text-[12.5px]">
    <div role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(!open); } }} className="flex h-9 cursor-pointer items-center gap-2 rounded-xl pl-3 pr-1.5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"><ProgressRing value={summary.settled} total={summary.total} className={summary.queued ? "stroke-emerald-500" : "stroke-blue-500"} /><span className="min-w-0 truncate">{summary.text}{summary.failed > 0 && <span className="text-red-600"> · {summary.failed} 项失败</span>}</span><span className="flex-1" />{!summary.queued && <button type="button" onClick={(event) => { event.stopPropagation(); onCancel(); }} className="h-6 shrink-0 rounded-md px-2 text-xs text-zinc-500 hover:bg-zinc-200">不用等了</button>}<Chevron className="size-3.5 text-zinc-400" /></div>
    {open && <ul className="max-h-40 overflow-y-auto px-3 pb-2">{summary.tasks.map((task) => <li key={task.taskId} className="flex items-center gap-2 text-xs"><button type="button" onClick={() => focusAgentNodes([task.nodeId])} className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left hover:bg-zinc-100">{task.label}</button><span className={task.statusText === "失败" ? "text-red-600" : task.statusText === "成功" ? "text-emerald-600" : "text-blue-600"}>{task.statusText}</span></li>)}</ul>}
  </div>;
}

