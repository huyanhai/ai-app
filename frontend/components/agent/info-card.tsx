"use client";

import { ExternalLink, LocateFixed } from "lucide-react";
import type { AgentCard, CardRef, CardTone, RefScope } from "@/lib/agent/card";
import { resolveRef } from "@/lib/agent/card";
import { cn } from "@/lib/utils";
import { focusAgentNodes } from "./canvas";

const toneClass = (tone?: CardTone) => tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-600" : "text-zinc-600";

export function InfoCard({ card, scope }: { card: AgentCard; scope: RefScope }) {
  const target = (ref?: CardRef) => resolveRef(ref, scope);
  const open = (ref?: CardRef) => { const resolved = target(ref); if (resolved?.kind === "node") focusAgentNodes([resolved.id]); };
  return <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white text-[13px] shadow-sm"><header className="border-b border-zinc-100 px-3 py-2.5 font-medium">{card.title}</header><div className="p-3">
    {card.kind === "summary" ? <dl className="flex flex-col gap-2">{card.rows.map((row, index) => <div key={`${row.label}-${index}`} className="flex items-start gap-3"><dt className="w-20 shrink-0 text-zinc-500">{row.label}</dt><dd className={cn("min-w-0 flex-1", toneClass(row.tone))}><button type="button" disabled={!target(row.ref)} onClick={() => open(row.ref)} className="text-left enabled:hover:underline">{row.value}{target(row.ref) && <LocateFixed className="ml-1 inline size-3" />}</button>{row.sub && <span className="block text-[11px] text-zinc-400">{row.sub}</span>}</dd>{row.badge && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px]">{row.badge}</span>}</div>)}</dl> : <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><thead><tr>{card.columns.map((column) => <th key={column} className="border-b border-zinc-200 px-2 py-1.5 font-medium text-zinc-500">{column}</th>)}</tr></thead><tbody>{card.rows.map((row, index) => <tr key={index}>{row.cells.map((cell, cellIndex) => <td key={cellIndex} className={cn("border-b border-zinc-100 px-2 py-2", toneClass(cell.tone))}><button type="button" disabled={!target(cell.ref)} onClick={() => open(cell.ref)} className="text-left enabled:hover:underline">{cell.text}</button></td>)}</tr>)}</tbody></table></div>}
    {card.notes.length > 0 && <div className="mt-3 space-y-1">{card.notes.map((note, index) => <p key={index} className={cn("rounded-lg bg-zinc-50 px-2 py-1.5 text-xs", toneClass(note.tone))}>{note.text}</p>)}</div>}
    {card.sources.length > 0 && <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-2">{card.sources.map((source, index) => source.url ? <a key={index} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">{source.title}<ExternalLink className="size-3" /></a> : <span key={index} className="text-xs text-zinc-500">{source.title}</span>)}</div>}
  </div></section>;
}

