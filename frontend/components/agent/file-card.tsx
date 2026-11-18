import type { ReactNode } from "react";
import { documentLabel, formatFileSize } from "@/lib/agent/document-files";
import { cn } from "@/lib/utils";

export function FileCard({ name, size, className, leading, children }: {
  name: string;
  size?: number;
  className?: string;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div title={name} className={cn("relative flex h-14 min-w-[150px] max-w-60 shrink-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] pl-2.5 pr-7", className)}>
      <span aria-hidden className="relative grid h-9 w-8 shrink-0 place-items-center rounded-md bg-[#33a3ff]/15 text-[9.5px] font-bold tracking-wide text-[#33a3ff]">
        {documentLabel(name)}
        {leading}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-tight text-white/85">{name}</span>
        <span className="block truncate text-xs leading-snug text-white/40">{documentLabel(name)}{size === undefined ? "" : ` · ${formatFileSize(size)}`}</span>
      </span>
      {children}
    </div>
  );
}
