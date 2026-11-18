"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AtSign, AudioLines, ChevronRight, FileText, Image, Type, Video } from "lucide-react";
import type { SubjectReference, ReferenceKind } from "@/components/chat/types";
import { useClickOutSide } from "@/hooks/use-click-outside";

const CATEGORIES = [
  { kind: "subject" as const, label: "主体", icon: AtSign },
  { kind: "image" as const, label: "图片", icon: Image },
  { kind: "video" as const, label: "视频", icon: Video },
  { kind: "audio" as const, label: "音频", icon: AudioLines },
  { kind: "text" as const, label: "文本", icon: Type },
];

interface ReferencePickerProps {
  references: SubjectReference[];
  position: { left: number; top: number };
  query: string;
  allowedKinds?: ReferenceKind[];
  onSelect: (reference: SubjectReference) => void;
  onClose: () => void;
}

export default function ReferencePicker({ references, position, query, allowedKinds, onSelect, onClose }: ReferencePickerProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeKind, setActiveKind] = useState<ReferenceKind | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  useClickOutSide(menuRef, onClose, true);
  const normalizedQuery = query.toLocaleLowerCase();
  const matches = (reference: SubjectReference) =>
    (!allowedKinds || allowedKinds.includes(reference.kind ?? "subject")) &&
    reference.name.toLocaleLowerCase().includes(normalizedQuery);
  const searchMode = normalizedQuery.length > 0;
  const recent = searchMode
    ? references.filter(matches)
    : references.filter((item) => item.kind !== "text").slice(0, 4);
  const activeReferences = references.filter((item) => (item.kind ?? "subject") === activeKind && matches(item));
  const categories = CATEGORIES.filter(({ kind }) => !allowedKinds || allowedKinds.includes(kind));
  const openOnLeft = position.left + 256 + 8 + 208 > window.innerWidth - 16;

  const select = (reference: SubjectReference) => {
    onSelect(reference);
    onClose();
  };

  useEffect(() => {
    setActiveKind(null);
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      const count = activeKind ? activeReferences.length : searchMode ? recent.length : recent.length + categories.length;
      const stop = () => { event.preventDefault(); event.stopPropagation(); };
      if (event.key === "Escape") {
        stop();
        if (activeKind) setActiveKind(null);
        else onClose();
        return;
      }
      if (event.key === "ArrowLeft" && activeKind) {
        stop();
        setActiveKind(null);
        setActiveIndex(recent.length + categories.findIndex(({ kind }) => kind === activeKind));
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!count) return;
        stop();
        setActiveIndex((current) => (Math.min(current, count - 1) + (event.key === "ArrowDown" ? 1 : -1) + count) % count);
        return;
      }
      const categoryIndex = activeIndex - recent.length;
      if (event.key === "ArrowRight" && !activeKind && !searchMode && categories[categoryIndex]) {
        stop();
        setActiveKind(categories[categoryIndex].kind);
        setActiveIndex(0);
        return;
      }
      if (event.key !== "Enter" && event.key !== "Tab") return;
      if (!count) return;
      stop();
      if (activeKind) {
        const reference = activeReferences[activeIndex];
        if (reference) select(reference);
      } else if (activeIndex < recent.length) {
        select(recent[activeIndex]);
      } else if (!searchMode && categories[categoryIndex]) {
        setActiveKind(categories[categoryIndex].kind);
        setActiveIndex(0);
      }
    };
    window.addEventListener("keydown", keyDown, true);
    return () => window.removeEventListener("keydown", keyDown, true);
  }, [activeIndex, activeKind, activeReferences, categories, onClose, recent, searchMode]);

  return createPortal(
    <div
      ref={menuRef}
      onMouseDown={(event) => event.preventDefault()}
      className="fixed z-[70] w-64 -translate-y-full rounded-2xl border border-white/10 bg-[#242424] p-2 shadow-2xl"
      style={{ left: position.left, top: position.top - 8 }}
    >
      {recent.length > 0 && (
        <div className={searchMode ? "" : "mb-1 border-b border-white/8 pb-2"}>
          <div className="px-2 py-1.5 text-xs text-white/35">可能 @ 的内容</div>
          {recent.map((reference, index) => (
            <button key={reference.id} type="button" onMouseEnter={() => { setActiveKind(null); setActiveIndex(index); }} onClick={() => select(reference)} className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/8 ${!activeKind && activeIndex === index ? "bg-white/8" : ""}`}>
              <ReferencePreview reference={reference} />
              <span className="truncate text-xs text-white/85">{reference.name}</span>
            </button>
          ))}
        </div>
      )}
      {!searchMode && <div className="px-2 py-1.5 text-xs text-white/35">添加参考</div>}
      {!searchMode && <div className="relative">
        {categories.map(({ kind, label, icon: Icon }, index) => (
          <div key={kind} className="relative">
            <button
              type="button"
              onMouseEnter={() => { setActiveKind(kind); setActiveIndex(0); }}
              onClick={() => { setActiveKind(kind); setActiveIndex(0); }}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm ${activeKind === kind || (!activeKind && activeIndex === recent.length + index) ? "bg-white/8 text-white" : "text-white/80 hover:bg-white/8"}`}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              <ChevronRight size={15} className="text-white/35" />
            </button>
            {activeKind === kind && (
              <div className={`absolute top-1/2 max-h-64 w-52 -translate-y-1/2 overflow-y-auto rounded-xl border border-white/10 bg-[#242424] p-1.5 shadow-2xl ${openOnLeft ? "right-full mr-2" : "left-full ml-2"}`}>
                {activeReferences.length === 0 && <div className="px-3 py-4 text-center text-xs text-white/35">暂无可用内容</div>}
                {activeReferences.map((reference, index) => (
                  <button key={reference.id} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => select(reference)} className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/8 ${activeIndex === index ? "bg-white/8" : ""}`}>
                    <ReferencePreview reference={reference} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-white/85">{reference.name}</span>
                      {reference.description && <span className="mt-0.5 block truncate text-[11px] text-white/35">{reference.description}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>}
      {searchMode && recent.length === 0 && <div className="px-3 py-5 text-center text-xs text-white/35">未找到匹配内容</div>}
    </div>,
    document.body,
  );
}

function ReferencePreview({ reference }: { reference: SubjectReference }) {
  if (reference.kind === "image" && reference.url) {
    return <img src={reference.url} alt="" className="size-8 shrink-0 rounded-md object-cover" />;
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/8 text-white/50">
      <FileText size={15} />
    </span>
  );
}
