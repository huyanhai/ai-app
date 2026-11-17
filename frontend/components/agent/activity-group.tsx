"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Camera, ChevronRight, CircleStop, Clapperboard, Film, Globe, LayoutGrid, Lightbulb, ListChecks, ListTodo, Loader2, LocateFixed, MessageCircleQuestion, PencilLine, ScanEye, Search, Terminal, Trash2, WandSparkles, Wrench, type LucideIcon } from "lucide-react";
import type { TimelineItem, ToolCall } from "@/lib/agent/timeline";
import { activitySummary, formatSeconds, toolIcon, type VerbIcon } from "@/lib/agent/activity";
import { cn } from "@/lib/utils";
import { focusAgentNodes } from "./canvas";

type Activity = Extract<TimelineItem, { type: "activity" }>;
const ICONS: Record<VerbIcon, LucideIcon> = { read: BookOpen, edit: PencilLine, arrange: LayoutGrid, delete: Trash2, look: ScanEye, plan: ListChecks, ask: MessageCircleQuestion, models: Clapperboard, generate: WandSparkles, task: ListTodo, skill: Lightbulb, script: Terminal, video: Film, frame: Camera, search: Search, web: Globe, other: Wrench };

export function ActivityGroup({ item }: { item: Activity }) {
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? item.status === "running";
  const summary = activitySummary(item);
  const running = item.status === "running";
  const aborted = item.status === "aborted";
  const HeadIcon = running ? Loader2 : aborted ? CircleStop : ICONS[summary.icon];
  const line = aborted ? `已中止 · ${summary.phrase}` : item.summary ?? summary.phrase;
  return <div className="flex flex-col"><button type="button" aria-expanded={open} onClick={() => setManual(!open)} className="group -ml-2 inline-flex h-7 max-w-full items-center gap-2 self-start rounded-lg px-2 text-[12.5px] text-zinc-500 outline-none hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500/40"><HeadIcon className={cn("size-3.5 shrink-0", running && "animate-spin")} />{running ? <span>处理中</span> : <><span className="min-w-0 truncate">{line}</span>{item.errors > 0 && <span className="shrink-0 text-amber-600">· {item.errors} 项失败</span>}{summary.seconds !== null && <span className="shrink-0 tabular-nums">{formatSeconds(summary.seconds)}</span>}</>}<ChevronRight className={cn("size-3.5 shrink-0 opacity-0 transition-[opacity,transform] group-hover:opacity-100 group-focus-visible:opacity-100", open && "rotate-90")} /></button><AnimatePresence initial={false}>{open && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="ml-1.5 mt-1 flex flex-col pl-3">{item.tools.map((tool) => <ToolRow key={tool.key} tool={tool} />)}</motion.div>}</AnimatePresence></div>;
}

function ToolRow({ tool }: { tool: ToolCall }) {
  const Icon = tool.status === "running" ? Loader2 : ICONS[toolIcon(tool)];
  const canLocate = tool.nodeIds.length > 0;
  return <button type="button" disabled={!canLocate} onClick={() => focusAgentNodes(tool.nodeIds)} className={cn("group -ml-2 flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-zinc-500 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40", canLocate && "hover:bg-zinc-100 hover:text-zinc-800")}><Icon className={cn("size-3.5 shrink-0", tool.status === "running" && "animate-spin", tool.status === "error" && "text-amber-600")} /><span className="shrink-0 font-medium text-zinc-700">{tool.label || tool.name}</span>{tool.summary && <span className="truncate">{tool.summary}</span>}{tool.status === "error" && <span className="ml-auto shrink-0 text-amber-600">失败</span>}{tool.status === "aborted" && <span className="ml-auto shrink-0">已中止</span>}{canLocate && <LocateFixed className="ml-auto size-3.5 shrink-0 opacity-0 group-hover:opacity-100" />}</button>;
}

