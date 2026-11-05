"use client";

import { useEffect, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";
import ToolboxModal from "./toolbox/toolbox-modal";
import styleLibrary from "./video-style-prompts.json";

export const VIDEO_STYLES = styleLibrary.styles.map((style) => ({
  ...style,
  image: `/video-style-covers/${style.id}.png`,
  hasCover: style.id !== "style_074",
}));

export type VideoStyleId = string;
const CATEGORIES = ["全部", ...styleLibrary.categories];

export const getVideoStylePrompt = (style?: { videoPrompt: string; negativePrompt: string }) => style
  ? `${style.videoPrompt}\n\n负面约束：${style.negativePrompt}`
  : undefined;

export default function VideoStylePicker({ open, value, onClose, onConfirm }: {
  open: boolean;
  value: VideoStyleId;
  onClose: () => void;
  onConfirm: (value: VideoStyleId) => void;
}) {
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) {
      setCategory("全部");
      setQuery("");
    }
  }, [open]);
  const visibleStyles = VIDEO_STYLES.filter((style) =>
    (category === "全部" || style.category === category) &&
    style.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <ToolboxModal open={open} title="选择视频风格" width={1080} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 px-6 pt-5 mb-6">
        {CATEGORIES.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 text-xs transition ${category === item ? "bg-white text-black" : "bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"}`}>{item}</button>)}
        <label className="ml-auto flex h-8 w-40 items-center gap-2 rounded-lg bg-white/5 px-2.5 text-white/40 focus-within:bg-white/10">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索风格" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30" />
        </label>
      </div>
      <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto px-6 mb-6 sm:grid-cols-3 lg:grid-cols-5">
        {visibleStyles.map((style) => (
          <button type="button" key={style.id} onClick={() => onConfirm(style.id)} className={`relative overflow-hidden rounded-xl border text-left transition ${value === style.id ? "border-white/70 ring-2 ring-white/15" : "border-white/10 hover:border-white/30"}`}>
            {style.hasCover ? <img src={style.image} alt={style.name} className="aspect-[3/4] w-full object-cover" /> : <span className="flex aspect-[3/4] items-center justify-center bg-white/5 text-white/25"><Sparkles size={28} /></span>}
            <span className="block px-3 py-2 text-sm text-white/85">{style.name}</span>
            {value === style.id && <span className="absolute right-2 top-2 rounded-full bg-white p-1 text-black"><Check size={12} /></span>}
          </button>
        ))}
        {!visibleStyles.length && <div className="col-span-full py-16 text-center text-sm text-white/35">没有匹配的风格</div>}
      </div>
    </ToolboxModal>
  );
}
