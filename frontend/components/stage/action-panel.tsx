"use client";

import { useEffect, useMemo, useState } from "react";
import { Info, Plus, Search } from "lucide-react";
import { StageModal } from "./controls";
import motionCatalog from "./motion-catalog.json";

export type ActionPreset = {
  id: string;
  assetId?: string;
  name: string;
  description: string;
  image: string;
  duration: number;
  kind: "action" | "walk" | "run";
  category?: "action" | "pose";
};

type MotionCatalogEntry = {
  id: string;
  name: string;
  description: string;
  image: string;
  motionUsage: "direct" | "path-traversal";
};

const ACTION_PRESETS: ActionPreset[] = (motionCatalog as MotionCatalogEntry[]).map((motion) => ({
  id: motion.id,
  assetId: motion.id,
  name: motion.name,
  description: motion.description,
  image: motion.image,
  duration: motion.name.includes("跑") ? 4 : motion.motionUsage === "path-traversal" ? 6 : 4,
  kind: motion.motionUsage === "path-traversal" ? motion.name.includes("跑") ? "run" : "walk" : "action",
  category: /坐姿|跪|站立|待机|蹲|躺|卧|倚|靠|静止|姿势/.test(motion.name) ? "pose" : "action",
}));
const PATH_PRESETS = ACTION_PRESETS.filter((preset) => preset.kind !== "action");

export function ActionPanel({ pathMode = false, poseMode = false, onClose, onSelect }: { pathMode?: boolean; poseMode?: boolean; onClose: () => void; onSelect: (preset: ActionPreset) => void }) {
  const [tab, setTab] = useState<"action" | "pose">(poseMode ? "pose" : "action");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
  useEffect(() => setVisibleCount(40), [pathMode, search, tab]);
  const presets = useMemo(() => {
    const source = pathMode ? PATH_PRESETS : ACTION_PRESETS.filter((preset) => preset.category === tab);
    return source.filter((preset) => `${preset.name}${preset.description}`.includes(search.trim()));
  }, [pathMode, search, tab]);

  return (
    <StageModal title={pathMode ? "选择行走动作" : poseMode ? "预设姿势" : "添加动作"} onClose={onClose} className="w-[min(1080px,calc(100vw-64px))]">
      {!pathMode && <div className="mb-5 flex gap-6 border-b border-white/8 text-xs">{(["action", "pose"] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`relative pb-3 ${tab === item ? "text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-white" : "text-white/35 hover:text-white/70"}`}>{item === "action" ? "动作" : "静态姿势"}</button>)}</div>}
      <div className="mb-4 flex items-center text-xs text-white/65"><span className="flex items-center gap-2">动作库 <Info size={12} className="text-white/35" /></span>{!pathMode && <span className="ml-auto rounded-md bg-white/[0.04] px-3 py-2 text-[10px] text-white/40">预设 · {ACTION_PRESETS.length}　　我的 · 0</span>}</div>
      <label className="mb-4 flex h-11 items-center gap-2 rounded-lg bg-white/[0.055] px-3"><Search size={16} className="text-white/35" /><input autoFocus aria-label="搜索动作" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索动作" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-white/25" /></label>
      {!pathMode && !poseMode && <button type="button" className="mb-5 flex w-full items-center justify-center gap-1 rounded-lg bg-white/[0.055] py-3 text-xs text-white/65 hover:bg-white/[0.08]" onClick={() => onSelect({ id: `custom-${Date.now()}`, name: "自定义动作", description: "自定义角色动作。", image: "/stage/assets/male-standard.png", duration: 4, kind: "action", category: tab })}><Plus size={14} />新建动作</button>}
      <div className="grid max-h-[48vh] grid-cols-2 gap-4 overflow-y-auto pr-1 md:grid-cols-4">
        {presets.slice(0, visibleCount).map((preset) => <button type="button" key={preset.id} onClick={() => onSelect(preset)} className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.035] text-left transition hover:border-white/25 hover:bg-white/[0.06]"><div className="aspect-[4/3] overflow-hidden bg-black"><img src={preset.image} alt={preset.name} loading="lazy" className="h-full w-full object-cover" /></div><div className="p-3"><div className="text-xs text-white/85">{preset.name}</div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/35">{preset.description}</p></div></button>)}
      </div>
      {visibleCount < presets.length && <button type="button" onClick={() => setVisibleCount((count) => count + 40)} className="mt-4 w-full rounded-md border border-white/10 py-2 text-xs text-white/50 hover:bg-white/5">加载更多 · 剩余 {presets.length - visibleCount}</button>}
      {!presets.length && <div className="py-16 text-center text-xs text-white/30">未找到相关动作</div>}
    </StageModal>
  );
}
