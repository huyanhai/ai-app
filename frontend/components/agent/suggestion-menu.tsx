"use client";

import { useEffect, useRef, type ComponentType } from "react";
import { cn } from "@/lib/utils";

export type SuggestionItem = { key: string; icon: ComponentType<{ className?: string }>; title: string; hint?: string };

export function SuggestionMenu({ label, items, active, onActive, onPick, notice }: { label: string; items: readonly SuggestionItem[]; active: number; onActive: (index: number) => void; onPick: (index: number) => void; notice?: string | null }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.children[active]?.scrollIntoView({ block: "nearest" }); }, [active]);
  return (
    <div className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-[min(300px,calc(100vw-48px))] overflow-hidden rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl">
      <p className="px-2 pb-1 pt-0.5 text-[11px] text-zinc-500">{label}</p>
      {notice ? <p className="px-2 py-4 text-center text-xs text-zinc-500">{notice}</p> : <div ref={list} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto">{items.map((item, index) => { const Icon = item.icon; return <button key={item.key} type="button" role="option" aria-selected={index === active} onMouseEnter={() => onActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(index)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px]", index === active ? "bg-zinc-100" : "hover:bg-zinc-50")}><Icon className="size-4 shrink-0 text-zinc-500" /><span className="min-w-0 flex-1"><span className="block truncate">{item.title}</span>{item.hint && <span className="block truncate text-[11px] text-zinc-500">{item.hint}</span>}</span></button>; })}</div>}
    </div>
  );
}

