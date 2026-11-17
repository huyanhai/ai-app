import { FileText } from "lucide-react";

export function FileCard({ name, size, error }: { name: string; size?: number; error?: string }) {
  const sizeText = typeof size === "number" ? size < 1024 ? `${size} B` : `${Math.ceil(size / 1024)} KB` : "文档";
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500"><FileText className="size-4" /></span>
      <span className="min-w-0"><span className="block truncate text-xs font-medium">{name}</span><span className="block truncate text-[11px] text-zinc-500">{error ?? sizeText}</span></span>
    </span>
  );
}

