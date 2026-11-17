"use client";

import { useState } from "react";
import { Lightbulb, PenLine, Search } from "lucide-react";
import type { Chip } from "@/lib/agent/chips";
import { filterSkills } from "@/lib/agent/skills";
import { AgentMenuButton, AgentPopover } from "./ui";
import { useSkillCatalog } from "./use-skill-catalog";
import { AGENT_ICON_BTN } from "./styles";

export function SkillPopover({ onPick, disabled }: { onPick: (chip: Chip) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "builtin" | "imported">("all");
  const catalog = useSkillCatalog(open);
  const skills = filterSkills(catalog.skills.filter((skill) => source === "all" || skill.source === source), query);
  return (
    <AgentPopover label="插入技能" side="top" open={open} onOpenChange={setOpen} disabled={disabled} className="w-[min(340px,calc(100vw-24px))] p-2" trigger={<span className={AGENT_ICON_BTN} title="插入技能"><PenLine /></span>}>
      <div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 size-3.5 text-zinc-400" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索技能" className="h-8 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-8 pr-2 text-xs outline-none focus:border-blue-400" /></div>
      <div className="mb-1 flex gap-1">{(["all", "builtin", "imported"] as const).map((value) => <button key={value} type="button" onClick={() => setSource(value)} className={`rounded-md px-2 py-1 text-[11px] ${source === value ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}>{value === "all" ? "全部" : value === "builtin" ? "内置" : "已导入"}</button>)}</div>
      <div className="max-h-64 overflow-y-auto">
        {catalog.status === "loading" && <p className="py-6 text-center text-xs text-zinc-500">正在加载技能…</p>}
        {catalog.status === "error" && <button type="button" onClick={() => void catalog.reload()} className="w-full py-6 text-xs text-red-600">加载失败，点击重试</button>}
        {catalog.status === "ready" && skills.length === 0 && <p className="py-6 text-center text-xs text-zinc-500">没有找到匹配的技能</p>}
        {catalog.status === "ready" && skills.map((skill) => <AgentMenuButton key={skill.name} onClick={() => onPick({ type: "skill", id: skill.name, name: skill.title })}><Lightbulb className="size-4 shrink-0 text-amber-500" /><span className="min-w-0 flex-1"><span className="block truncate">{skill.title}</span><span className="block truncate text-[11px] text-zinc-500">{skill.description}</span></span></AgentMenuButton>)}
      </div>
    </AgentPopover>
  );
}

