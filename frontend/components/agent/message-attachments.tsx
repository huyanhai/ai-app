"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { AgentAttachmentDto } from "@/api/agent/type";
import { FileCard } from "./file-card";

export function MessageAttachments({ items }: { items: AgentAttachmentDto[] }) {
  const [preview, setPreview] = useState<AgentAttachmentDto | null>(null);
  if (!items?.length) return null;
  return (
    <div className="flex max-w-[88%] flex-wrap justify-end gap-1.5">
      {items.map((item) => item.kind === "document" ? (
        <a key={item.asset_id} href={item.url} target="_blank" rel="noreferrer" aria-label={`打开文件：${item.name}`} className="rounded-xl outline-none hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#33a3ff]/60"><FileCard name={item.name} size={item.byte_size} className="pr-2.5" /></a>
      ) : (
        <button key={item.asset_id} type="button" aria-label={`查看大图：${item.name}`} title={item.name} onClick={() => setPreview(item)} className="cursor-zoom-in overflow-hidden rounded-lg ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-[#33a3ff]/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={item.name} draggable={false} className="size-12 object-cover" />
        </button>
      ))}
      {preview && <div role="dialog" aria-label={preview.name} className="fixed inset-0 z-[120] grid place-items-center bg-zinc-950/80 p-6" onClick={() => setPreview(null)}>
        <button type="button" aria-label="关闭预览" className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white/10 text-white"><X /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt={preview.name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
      </div>}
    </div>
  );
}

