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
  return <motion.div role="status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex min-h-5 items-center gap-1.5 text-[12.5px] text-zinc-500">{line.waiting ? <><Hand className="size-3.5 text-zinc-400" /><span>{line.text} ↓</span></> : <><ShimmerText>{line.text}</ShimmerText>{seconds !== null && <span className="tabular-nums">{seconds}s</span>}</>}</motion.div>;
}

