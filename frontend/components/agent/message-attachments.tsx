"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { AgentAttachmentDto } from "@/api/agent/type";
import { FileCard } from "./file-card";

export function MessageAttachments({ items }: { items: AgentAttachmentDto[] }) {
  const [preview, setPreview] = useState<AgentAttachmentDto | null>(null);
  if (!items?.length) return null;
  const images = items.filter((item) => item.kind !== "document");
  const documents = items.filter((item) => item.kind === "document");
  return (
    <div className="flex max-w-[88%] flex-col items-end gap-1.5">
      {images.length > 0 && <div className="grid max-w-full grid-cols-3 gap-1.5">{images.map((item) => <button key={item.asset_id} type="button" onClick={() => setPreview(item)} className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.name} className="size-24 object-cover transition-transform hover:scale-105" />
      </button>)}</div>}
      {documents.map((item) => <a key={item.asset_id} href={item.url} target="_blank" rel="noreferrer" className="w-56 rounded-xl border border-zinc-200 bg-white p-2 hover:bg-zinc-50"><FileCard name={item.name} size={item.byte_size} /></a>)}
      {preview && <div role="dialog" aria-label={preview.name} className="fixed inset-0 z-[120] grid place-items-center bg-zinc-950/80 p-6" onClick={() => setPreview(null)}>
        <button type="button" aria-label="关闭预览" className="absolute right-5 top-5 grid size-9 place-items-center rounded-full bg-white/10 text-white"><X /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt={preview.name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
      </div>}
    </div>
  );
}

