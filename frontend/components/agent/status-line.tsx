"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Hand } from "lucide-react";
import type { StatusLine as StatusLineModel } from "@/lib/agent/timeline";
import { ShimmerText } from "./shimmer-text";

export function StatusLine({ line }: { line: StatusLineModel }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (line.since === null || line.waiting) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [line.since, line.waiting]);
  const seconds = line.since === null || line.waiting ? null : Math.max(1, Math.round((now - line.since) / 1000));
  return <motion.div role="status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex min-h-5 items-center gap-1.5 text-[12.5px] text-zinc-500">{line.waiting ? <><Hand className="size-3.5 text-[#33a3ff]" /><span>{line.text} ↓</span></> : <><span aria-hidden className="size-2 rounded-full bg-[#33a3ff] shadow-[0_0_8px_rgba(51,163,255,.6)]" /><ShimmerText>{line.text}</ShimmerText>{seconds !== null && <span className="tabular-nums">{seconds}s</span>}<span className="ml-auto flex items-center gap-1 text-[11px] opacity-80"><kbd className="rounded border border-zinc-200 bg-zinc-50 px-1">Esc</kbd>停止</span></>}</motion.div>;
}

