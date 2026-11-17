import { X } from "lucide-react";

export type ContextRef = { id: string; label: string; hint?: string };

export function ContextChips({ refs, onRemove }: { refs?: readonly ContextRef[]; onRemove?: (id: string) => void }) {
  if (!refs?.length) return null;
  return <div className="flex flex-wrap gap-1 px-3 pt-2">{refs.map((ref) => <span key={ref.id} title={ref.hint} className="inline-flex h-6 max-w-44 items-center gap-1 rounded-md bg-blue-50 px-1.5 text-xs text-blue-700 ring-1 ring-blue-200"><span className="truncate">{ref.label}</span>{onRemove && <button type="button" aria-label={`移除 ${ref.label}`} onClick={() => onRemove(ref.id)} className="grid size-4 place-items-center rounded hover:bg-blue-100"><X className="size-3" /></button>}</span>)}</div>;
}

