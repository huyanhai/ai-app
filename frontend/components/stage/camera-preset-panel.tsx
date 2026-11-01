"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, Crosshair, RotateCcw, Route, Search, X } from "lucide-react";
import { CAMERA_PRESETS, CameraPresetDefinition, CameraPresetDraft, CameraPresetId } from "./camera-presets";
import { NumericInput } from "./controls";

const THUMB_PATHS: Record<CameraPresetId, string> = {
  "push-in": "M104 112 L151 94",
  "pull-back": "M151 94 L99 116",
  truck: "M76 109 L202 109",
  rise: "M127 119 L127 42",
  descend: "M127 42 L127 119",
  orbit: "M76 91 C76 37 232 37 232 91 C232 145 76 145 76 91 Z",
  arc: "M74 112 C88 35 220 35 235 105",
  "spiral-rise": "M88 124 C46 87 215 101 211 67 C207 31 112 58 139 27",
  "dolly-zoom": "M93 116 L155 91 M93 116 L178 126 M93 116 L176 60",
  dutch: "M112 108 L153 91 M111 108 L165 126",
  "pan-left": "M177 105 L83 83",
  "pan-right": "M113 105 L216 82",
  "tilt-up": "M143 119 L143 45",
  "tilt-down": "M143 45 L143 119",
};

function PresetThumbnail({ preset }: { preset: CameraPresetDefinition }) {
  const fixedCamera = preset.category === "fixed-camera";
  return (
    <svg viewBox="0 0 280 150" className="block size-full bg-[#151615]" aria-hidden="true">
      <g stroke="#30332f" strokeWidth="0.8" opacity="0.75">
        {[25, 50, 75, 100, 125].map((y) => <path key={y} d={`M20 ${y} H260`} />)}
        {[30, 65, 100, 135, 170, 205, 240].map((x) => <path key={x} d={`M${x} 20 L${140 + (x - 140) * 1.35} 135`} />)}
      </g>
      <path d={THUMB_PATHS[preset.id]} fill="none" stroke="#e7e9e4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={fixedCamera ? 143 : 195} cy={fixedCamera ? 119 : 75} r="4" fill="#181918" stroke="#f2f3ef" strokeWidth="2" />
      <g transform={fixedCamera ? "translate(143 119)" : "translate(104 112)"} fill="#f0f1ed">
        <path d="M-8-5 H3 L9 0 L3 5 H-8 Z" />
        <path d="M3-5 L17-11 V11 L3 5 Z" fill="none" stroke="#f0f1ed" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

export function CameraPresetDialog({ onClose, onSelect, onCustom }: {
  onClose: () => void;
  onSelect: (preset: CameraPresetDefinition) => void;
  onCustom: (kind: "camera" | "target" | "free") => void;
}) {
  const [search, setSearch] = useState("");
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const presets = useMemo(() => CAMERA_PRESETS.filter((preset) => `${preset.name}${preset.description}`.includes(search.trim())), [search]);
  const customMatches = !search.trim() || "自定义路径固定注视点固定机位自由运镜".includes(search.trim());
  const groups = [
    { id: "fixed-target" as const, label: "固定注视点" },
    { id: "fixed-camera" as const, label: "固定机位" },
  ];
  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-6 backdrop-blur-[2px]" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label="添加运镜" className="flex max-h-[86vh] w-[min(1120px,calc(100vw-64px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#202120] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="shrink-0 px-6 pb-5 pt-6">
          <div className="flex items-start justify-between">
            <div><h2 className="text-lg font-medium">添加运镜</h2><p className="mt-2 text-xs text-white/40">选择运镜预设，再设置注视点和运动路径。</p></div>
            <button type="button" aria-label="关闭添加运镜" onClick={onClose} className="rounded-md p-1.5 text-white/45 hover:bg-white/8 hover:text-white"><X size={17} /></button>
          </div>
          <label className="mt-5 flex h-10 items-center gap-2 rounded-lg border border-white/8 bg-white/[0.055] px-3 text-white/35 focus-within:border-white/20">
            <Search size={15} /><input autoFocus aria-label="搜索运镜素材" placeholder="搜索素材" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-white/80 outline-none placeholder:text-white/30" />
          </label>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {customMatches && <section aria-label="自定义路径">
            <h3 className="mb-3 text-sm font-medium text-white/85">自定义路径</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { kind: "camera" as const, title: "固定注视点", description: "固定注视点，让机位沿路径移动。", icon: Crosshair },
                { kind: "target" as const, title: "固定机位", description: "固定机位位置，让注视点沿路径移动。", icon: Camera },
                { kind: "free" as const, title: "自由运镜", description: "先绘制注视点路径，再绘制机位路径。两者在同一时间范围内移动。", icon: Route },
              ].map((item) => <button type="button" key={item.kind} onClick={() => onCustom(item.kind)} className="flex min-h-24 items-start gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-4 text-left hover:border-white/20 hover:bg-white/[0.06]"><item.icon size={18} className="mt-0.5 shrink-0 text-white/75" /><span><span className="block text-xs font-medium text-white/85">{item.title}</span><span className="mt-2 block text-[11px] leading-4 text-white/35">{item.description}</span></span></button>)}
            </div>
          </section>}
          <section aria-label="运镜预设" className="mt-6">
            <h3 className="mb-4 text-sm font-medium text-white/85">运镜预设</h3>
            {groups.map((group) => {
              const items = presets.filter((preset) => preset.category === group.id);
              if (!items.length) return null;
              return <section aria-label={group.label} key={group.id} className="mb-5"><h4 className="mb-2 text-xs text-white/40">{group.label}</h4><div className="grid grid-cols-4 gap-3">{items.map((preset) => <button type="button" key={preset.id} title={`${preset.name}：${preset.description}`} aria-label={`${preset.name}：${preset.description}`} onClick={() => onSelect(preset)} className="group rounded-xl border border-transparent p-1 text-left transition hover:border-white/20 hover:bg-white/[0.055] focus-visible:border-white/30 focus-visible:outline-none"><span className="relative block aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black/20"><PresetThumbnail preset={preset} /></span><span className="mt-2 block truncate px-1 pb-1 text-xs text-white/60 group-hover:text-white">{preset.name}</span></button>)}</div></section>;
            })}
            {!presets.length && !customMatches && <div className="py-16 text-center text-xs text-white/35">没有找到相关运镜</div>}
          </section>
        </div>
      </section>
    </div>
  );
}

const inputClass = "h-8 w-full rounded-md border border-white/8 bg-black/20 px-2 text-xs text-white/80 outline-none";

export function CameraPresetWizard({ draft, onChange, onClose, onApply }: {
  draft: CameraPresetDraft;
  onChange: (patch: Partial<CameraPresetDraft>) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const fixedCamera = draft.preset.category === "fixed-camera";
  if (draft.step === 3) return (
    <div className="absolute left-1/2 top-4 z-40 w-[min(720px,calc(100%-390px))] -translate-x-1/2 rounded-xl border border-white/12 bg-[#202120]/95 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-3"><div><div className="text-[10px] text-white/35">步骤 3/3 · 设置时间并预览</div><h2 className="mt-1 text-sm font-medium">预览运镜 · {draft.preset.name}</h2></div><button type="button" onClick={() => onChange({ step: 2 })} className="ml-auto flex items-center gap-1 rounded-md px-3 py-2 text-xs text-white/60 hover:bg-white/8"><ChevronLeft size={13} />上一步</button><button type="button" onClick={onClose} className="flex items-center gap-1 rounded-md px-3 py-2 text-xs text-white/60 hover:bg-white/8"><X size={13} />取消</button><button type="button" onClick={onApply} className="flex items-center gap-1 rounded-md bg-white px-4 py-2 text-xs font-medium text-black hover:bg-white/85"><Check size={14} />应用运镜</button></div>
      <div className="mt-4 grid grid-cols-[1fr_1fr_1.5fr] items-end gap-4">
        <label className="text-[10px] text-white/40"><span className="mb-1.5 block">开始时间 · 秒</span><NumericInput label="运镜开始时间" min={0} step={0.1} value={Number(draft.start.toFixed(2))} onChange={(start) => onChange({ start })} className={inputClass} /></label>
        <label className="text-[10px] text-white/40"><span className="mb-1.5 block">时长 · 秒</span><NumericInput label="运镜时长" min={0.1} max={60} step={0.1} value={draft.duration} onChange={(duration) => onChange({ duration })} className={inputClass} /></label>
        <label className="text-[10px] text-white/40"><span className="mb-1.5 flex justify-between"><span>运动幅度</span><span className="text-white/65">{draft.amplitude.toFixed(1)}×</span></span><input aria-label="运动幅度" type="range" min={0.2} max={3} step={0.1} value={draft.amplitude} onChange={(event) => onChange({ amplitude: Number(event.target.value) })} className="h-8 w-full accent-white" /></label>
      </div>
      <p className="mt-3 text-[10px] text-white/30">拖动时间轴或播放以预览，应用后仍可在属性轨道中编辑关键帧。</p>
    </div>
  );
  return (
    <div className="absolute left-4 top-4 z-40 w-72 rounded-xl border border-white/12 bg-[#202120]/95 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between"><div><div className="text-[10px] text-white/35">步骤 {draft.step}/3</div><h2 className="mt-1 text-sm font-medium">{draft.step === 1 ? "设置注视点" : fixedCamera ? "调整注视点路径" : "调整机位路径"}</h2></div><button type="button" aria-label="取消运镜" onClick={onClose} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/50 hover:bg-white/8"><X size={13} />取消</button></div>
      <p className="mt-2 text-xs text-white/60">设置运镜 · {draft.preset.name}</p>
      <p className="mt-2 text-[11px] leading-4 text-white/35">{draft.step === 1 ? "拖动手柄微调注视点，或重新在地面放置。" : "在场景中拖动以旋转方向，或输入方向和距离。"}</p>
      {draft.step === 1 ? <label className="mt-4 block text-[10px] text-white/40"><span className="mb-1.5 block">注视点高度 · 米</span><NumericInput label="运镜注视点高度" min={0} max={100} step={0.1} value={draft.target[1]} onChange={(height) => onChange({ target: [draft.target[0], height, draft.target[2]] })} className={inputClass} /></label> : <div className="mt-4 grid grid-cols-2 gap-2"><label className="text-[10px] text-white/40"><span className="mb-1.5 block">方向 · °</span><NumericInput label="运镜路径方向" min={-360} max={360} step={1} value={Math.round(draft.angle * 180 / Math.PI)} onChange={(angle) => onChange({ angle: angle * Math.PI / 180 })} className={inputClass} /></label><label className="text-[10px] text-white/40"><span className="mb-1.5 block">距离 · 米</span><NumericInput label={fixedCamera ? "注视点距离" : "机位距离"} min={0.5} max={100} step={0.1} value={Number(draft.distance.toFixed(2))} onChange={(distance) => onChange({ distance })} className={inputClass} /></label></div>}
      <div className="mt-4 flex items-center justify-between gap-2">
        {draft.step === 1 ? <button type="button" onClick={() => onChange({ placingTarget: true })} className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs text-white/65 hover:bg-white/8"><RotateCcw size={12} />重新放置</button> : <button type="button" onClick={() => onChange({ step: 1 })} className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 text-xs text-white/65 hover:bg-white/8"><ChevronLeft size={12} />上一步</button>}
        <button type="button" onClick={() => onChange({ step: draft.step === 1 ? 2 : 3, placingTarget: false })} className="ml-auto flex items-center gap-1 rounded-md border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/8">下一步<ChevronRight size={12} /></button>
      </div>
    </div>
  );
}
