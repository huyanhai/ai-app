"use client";

import { useRef, useState } from "react";
import { Aperture, Box, Camera, Image, PanelLeftClose, Plus, Search, User } from "lucide-react";
import { CHARACTER_ASSETS, GEOMETRY_ASSETS } from "./asset-catalog";
import { PROCEDURAL_ASSETS, PROCEDURAL_CATEGORIES } from "./procedural-catalog";
import { IconButton } from "@/components/ui/icon-button";

type AssetTab = "character" | "prop" | "background" | "camera";

const TABS: { id: AssetTab; label: string; icon: typeof User }[] = [
  { id: "character", label: "角色", icon: User },
  { id: "prop", label: "物体", icon: Box },
  { id: "background", label: "背景", icon: Image },
  { id: "camera", label: "机位", icon: Camera },
];

export function AssetPanel({
  onClose,
  onAdd,
  onImport,
  onEnvironment,
}: {
  onClose: () => void;
  onAdd: (type: "character" | "prop" | "camera", name: string) => void;
  onImport: (file: File, type: "character" | "prop") => void;
  onEnvironment: (environment: string) => void;
}) {
  const [tab, setTab] = useState<AssetTab>("character");
  const [scope, setScope] = useState("全部");
  const [search, setSearch] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const label = TABS.find((item) => item.id === tab)?.label;
  const scopes = tab === "prop" ? ["全部", "几何体", "物体", "我的"] : ["全部", "我的"];
  const characters = CHARACTER_ASSETS.filter((asset) => asset.name.includes(search));
  const geometries = GEOMETRY_ASSETS.filter((asset) => asset.name.includes(search));
  const proceduralAssets = PROCEDURAL_ASSETS.filter((asset) => asset.name.includes(search) || asset.nameEn.toLowerCase().includes(search.toLowerCase()));
  const showLibrary = scope !== "我的";

  return (
    <aside className="relative z-20 flex w-[248px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#1b1b1b]">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/6 px-3 text-xs font-medium"><Box size={15} /><h2>资产</h2><IconButton label="关闭资产" className="ml-auto" onClick={onClose}><PanelLeftClose size={15} /></IconButton></div>
      <div role="tablist" aria-label="资产" className="flex h-12 shrink-0 items-center justify-around border-b border-white/6 px-2">
        {TABS.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" role="tab" aria-label={item.label} aria-selected={tab === item.id} onClick={() => { setTab(item.id); setScope("全部"); setSearch(""); }} className={`relative flex size-9 items-center justify-center text-white/40 hover:text-white ${tab === item.id ? "text-white after:absolute after:-bottom-[6px] after:left-0 after:h-0.5 after:w-full after:bg-white" : ""}`}><Icon size={17} /></button>; })}
      </div>
      <div className="p-3">
        <label className="flex h-9 items-center gap-2 rounded-md bg-white/[0.055] px-2"><Search size={14} className="text-white/30" /><input aria-label={`搜索素材 · ${label}`} placeholder="搜索素材" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-white/25" /></label>
        <div role="tablist" className="mt-3 flex gap-1">{scopes.map((item) => <button key={item} type="button" role="tab" aria-selected={scope === item} onClick={() => setScope(item)} className={`rounded-md px-2.5 py-1.5 text-[11px] ${scope === item ? "bg-white/8 text-white" : "text-white/40 hover:text-white/70"}`}>{item}</button>)}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="mb-2 text-[10px] text-white/35">我的</div>
        <button type="button" onClick={() => tab === "camera" ? onAdd("camera", "机位") : tab === "background" ? onEnvironment("影棚") : fileInput.current?.click()} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-white/[0.055] text-xs text-white/60 hover:bg-white/10"><Plus size={14} />{tab === "character" ? "添加角色" : tab === "prop" ? "添加物体" : tab === "background" ? "添加背景" : "添加机位"}</button>
        <input ref={fileInput} type="file" accept=".fbx,.glb,.gltf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file && (tab === "character" || tab === "prop")) onImport(file, tab); event.target.value = ""; }} />

        {showLibrary && tab === "character" && <><div className="mb-2 mt-5 text-[10px] text-white/35">预设</div><div className="grid grid-cols-2 gap-2">{characters.map((asset) => <button key={asset.id} type="button" data-asset-id={asset.id} onClick={() => onAdd("character", asset.name)} className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.035] p-1.5 text-left hover:border-white/25 hover:bg-white/[0.06]"><span className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-[#111]"><img src={asset.image} alt="" className="size-full object-contain p-1" /></span><span className="mt-2 block truncate px-1 text-[11px] text-white/75">{asset.name}</span><span className="block px-1 pb-1 text-[10px] text-white/30">预设</span></button>)}</div></>}

        {showLibrary && tab === "prop" && scope !== "物体" && <><div className="mb-2 mt-5 text-[10px] text-white/35">几何体</div><div className="grid grid-cols-2 gap-2">{geometries.map((asset) => <button key={asset.id} type="button" data-asset-id={`geometry-${asset.id}`} onClick={() => onAdd("prop", asset.name)} className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.035] p-1.5 text-left hover:border-white/25"><span className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-[#111] text-white/50"><img src={`/stage/geometry/${asset.id}.png`} alt="" className="size-full object-contain" /></span><span className="mt-2 block px-1 text-[11px] text-white/75">{asset.name}</span><span className="block px-1 pb-1 text-[10px] text-white/30">几何体</span></button>)}</div></>}
        {showLibrary && tab === "prop" && scope !== "几何体" && PROCEDURAL_CATEGORIES.map((category) => {
          const assets = proceduralAssets.filter((asset) => asset.category === category.id);
          if (!assets.length) return null;
          return <section key={category.id}><div className="mb-2 mt-5 text-[10px] text-white/35">{category.name}</div><div className="grid grid-cols-2 gap-2">{assets.map((asset) => <button key={asset.id} type="button" data-asset-id={`prop-${asset.id}`} onClick={() => onAdd("prop", asset.name)} className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.035] p-1.5 text-left hover:border-white/25 hover:bg-white/[0.06]"><span className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-[#111]"><img src={`/stage/props/${asset.id}.png`} alt="" className="size-full object-contain" /></span><span className="mt-2 block truncate px-1 text-[11px] text-white/75">{asset.name}</span><span className="block px-1 pb-1 text-[10px] text-white/30">{category.name}</span></button>)}</div></section>;
        })}

        {showLibrary && tab === "background" && <><div className="mb-2 mt-5 text-[10px] text-white/35">环境预设</div><div className="grid grid-cols-2 gap-2">{[{ name: "影棚", color: "#363636" }, { name: "城市", color: "#35465b" }, { name: "自然", color: "#3c5545" }, { name: "纯黑", color: "#050505" }].map((item) => <button key={item.name} type="button" onClick={() => onEnvironment(item.name)} className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.035] p-1.5 text-left hover:border-white/25"><span className="grid aspect-[4/3] place-items-center rounded-lg" style={{ background: `linear-gradient(${item.color}, #101010)` }}><Aperture size={25} className="text-white/35" /></span><span className="mt-2 block px-1 text-[11px] text-white/75">{item.name}</span><span className="block px-1 pb-1 text-[10px] text-white/30">预设</span></button>)}</div></>}

        {showLibrary && tab === "camera" && <><div className="mb-2 mt-5 text-[10px] text-white/35">预设</div><div className="grid grid-cols-2 gap-2">{["正面机位", "侧面机位", "俯视机位", "移动机位"].map((name) => <button key={name} type="button" onClick={() => onAdd("camera", name)} className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.035] p-1.5 text-left hover:border-white/25"><span className="grid aspect-[4/3] place-items-center rounded-lg bg-[#111] text-white/45"><Camera size={30} strokeWidth={1} /></span><span className="mt-2 block px-1 text-[11px] text-white/75">{name}</span><span className="block px-1 pb-1 text-[10px] text-white/30">预设</span></button>)}</div></>}
        {!showLibrary && <div className="py-12 text-center text-xs text-white/30">暂无自建资产</div>}
        {showLibrary && ((tab === "character" && !characters.length) || (tab === "prop" && !geometries.length && !proceduralAssets.length)) && <div className="py-12 text-center text-xs text-white/30">未找到素材</div>}
      </div>
    </aside>
  );
}
