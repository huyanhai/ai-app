"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, Loader2, RotateCcw, X } from "lucide-react";
import type { AgentAttachments } from "./use-agent-attachments";
import { FileCard } from "./file-card";

export function AttachmentTray({ attachments }: { attachments: AgentAttachments }) {
  if (!attachments.items.length) return null;
  return (
    <div className="flex max-h-32 gap-2 overflow-x-auto px-3 pt-3">
      <AnimatePresence initial={false}>
        {attachments.items.map((item) => (
          <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="group relative w-36 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5">
            {item.kind === "image" && item.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.previewUrl} alt={item.name} className="h-20 w-full rounded-lg object-cover" />
            ) : <div className="h-20 rounded-lg bg-zinc-50 p-2"><FileCard name={item.name} size={item.size} error={item.error} /></div>}
            <p className="truncate px-1 pt-1 text-[11px] text-zinc-600">{item.name}</p>
            {item.status === "uploading" && <div className="absolute inset-0 grid place-items-center bg-[#101010]/65"><Loader2 className="size-5 animate-spin text-blue-600" /><span className="absolute bottom-2 text-[10px]">{Math.round(item.progress)}%</span></div>}
            {item.status === "error" && <button type="button" onClick={() => attachments.retry(item.id)} className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#101010]/85 text-xs text-red-600"><CircleAlert className="size-4" />上传失败<RotateCcw className="size-3" /></button>}
            <button type="button" aria-label={`移除 ${item.name}`} onClick={() => attachments.remove(item.id)} className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-zinc-900/70 text-white opacity-0 transition-opacity hover:bg-zinc-900 group-hover:opacity-100 focus:opacity-100"><X className="size-3" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

