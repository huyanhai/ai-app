"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock, ImageIcon } from "lucide-react";
import { parseMessage } from "@/lib/agent/chips";

export type SteerTrayItem = { key: string; text: string; images?: number };
export function visibleSteers(items: readonly SteerTrayItem[], expanded: boolean) { const shown = expanded ? items : items.slice(0, 3); return { shown, hidden: items.length - shown.length }; }

export function SteerTray({ items }: { items: readonly SteerTrayItem[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const { shown, hidden } = visibleSteers(items, expanded);
  return <div className="flex flex-col border-b border-zinc-200/70 px-1 py-1"><AnimatePresence initial={false}>{shown.map((item) => { const text = parseMessage(item.text).map((part) => part.kind === "text" ? part.text : part.chip.name).join("").replace(/\s+/g, " ").trim(); return <motion.div key={item.key} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 30 }} exit={{ opacity: 0, height: 0 }} title={text} className="flex items-center gap-2 overflow-hidden rounded-lg px-2 text-[12.5px] text-zinc-600"><Clock className="size-3 shrink-0 text-blue-500" /><span className="min-w-0 flex-1 truncate">{text}</span>{item.images ? <span className="flex items-center gap-1 text-[11px] text-zinc-400"><ImageIcon className="size-3" />{item.images} 张图</span> : null}</motion.div>; })}</AnimatePresence>{items.length > 3 && <button type="button" onClick={() => setExpanded(!expanded)} className="h-6 rounded-lg pl-7 text-left text-xs text-zinc-500 hover:text-zinc-800">{expanded ? "收起" : `还有 ${hidden} 条`}</button>}</div>;
}

