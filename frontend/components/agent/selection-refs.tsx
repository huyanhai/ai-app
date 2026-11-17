"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import type { RefNode } from "./types";

export function SelectionRefs({ ids, nodes, interactive = false, onFocus }: { ids: readonly string[]; nodes: readonly RefNode[]; interactive?: boolean; onFocus?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!ids?.length) return null;
  const refs = [...new Set(ids)].map((id) => ({ id, label: nodes.find((node) => node.id === id)?.label ?? "已删除的节点", missing: !nodes.some((node) => node.id === id) }));
  const shown = expanded ? refs : refs.slice(0, 3);
  return <div className="flex max-w-[88%] flex-wrap justify-end gap-1">{shown.map((ref) => <button key={ref.id} type="button" disabled={!interactive || ref.missing} onClick={() => onFocus?.(ref.id)} className="inline-flex h-6 max-w-40 items-center gap-1 rounded-md bg-zinc-100 px-1.5 text-xs text-zinc-600 enabled:hover:bg-zinc-200 disabled:cursor-default"><FileText className="size-3 shrink-0" /><span className="truncate">{ref.label}</span></button>)}{refs.length > 3 && <button type="button" onClick={() => setExpanded(!expanded)} className="h-6 rounded-md px-1.5 text-xs text-zinc-500 hover:bg-zinc-100">{expanded ? "收起" : `+${refs.length - 3}`}</button>}</div>;
}

