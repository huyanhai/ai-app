"use client";

import { useRef, useState } from "react";
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
  const openOnLeft = position.left + 256 + 8 + 208 > window.innerWidth - 16;

  const select = (reference: SubjectReference) => {
    onSelect(reference);
    onClose();
  };

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
          {recent.map((reference) => (
            <button key={reference.id} type="button" onClick={() => select(reference)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/8">
              <ReferencePreview reference={reference} />
              <span className="truncate text-xs text-white/85">{reference.name}</span>
            </button>
          ))}
        </div>
      )}
      {!searchMode && <div className="px-2 py-1.5 text-xs text-white/35">添加参考</div>}
      {!searchMode && <div className="relative">
        {CATEGORIES.filter(({ kind }) => !allowedKinds || allowedKinds.includes(kind)).map(({ kind, label, icon: Icon }) => (
          <div key={kind} className="relative">
            <button
              type="button"
              onMouseEnter={() => setActiveKind(kind)}
              onClick={() => setActiveKind(kind)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm ${activeKind === kind ? "bg-white/8 text-white" : "text-white/80 hover:bg-white/8"}`}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              <ChevronRight size={15} className="text-white/35" />
            </button>
            {activeKind === kind && (
              <div className={`absolute top-1/2 max-h-64 w-52 -translate-y-1/2 overflow-y-auto rounded-xl border border-white/10 bg-[#242424] p-1.5 shadow-2xl ${openOnLeft ? "right-full mr-2" : "left-full ml-2"}`}>
                {activeReferences.length === 0 && <div className="px-3 py-4 text-center text-xs text-white/35">暂无可用内容</div>}
                {activeReferences.map((reference) => (
                  <button key={reference.id} type="button" onClick={() => select(reference)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/8">
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
