"use client";
import { useEffect, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { AnimatePresence, motion } from "motion/react";
import { Map as MapIcon, MousePointer2, Waypoints } from "lucide-react";
import { usePipelineStore } from "@/store/pipeline-store";
import { useClickOutSide } from "@/hooks/use-click-outside";

// 即梦风格左下视窗控制条：选择工具 / 小地图 / 显示连线 / 缩放菜单
const Controls = () => {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const showMiniMap = usePipelineStore((s) => s.showMiniMap);
  const toggleMiniMap = usePipelineStore((s) => s.toggleMiniMap);
  const showEdges = usePipelineStore((s) => s.showEdges);
  const toggleEdges = usePipelineStore((s) => s.toggleEdges);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutSide([menuRef], () => setZoomMenuOpen(false), zoomMenuOpen);

  // 快捷键：⌘+/⌘- 缩放，⇧1 适配画布，⌘1 100%
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA"].includes(target.tagName)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomIn();
        } else if (e.key === "-") {
          e.preventDefault();
          zoomOut();
        } else if (e.key === "1") {
          e.preventDefault();
          zoomTo(1);
        }
      } else if (e.shiftKey && e.key === "!") {
        e.preventDefault();
        fitView();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomIn, zoomOut, zoomTo, fitView]);

  const zoomItems: {
    label: string;
    shortcut?: string;
    disabled?: boolean;
    hint?: string;
    dividerAfter?: boolean;
    onClick?: () => void;
  }[] = [
    { label: "放大视图", shortcut: "⌘ +", onClick: () => zoomIn() },
    { label: "缩小视图", shortcut: "⌘ -", onClick: () => zoomOut() },
    { label: "适配画布", shortcut: "⇧ 1", onClick: () => fitView() },
    {
      label: "缩放至选中项",
      shortcut: "⇧ 2",
      disabled: true,
      hint: "请先选择至少一个画布元素",
      dividerAfter: true,
    },
    { label: "缩放至50%", onClick: () => zoomTo(0.5) },
    { label: "缩放至100%", shortcut: "⌘ 1", onClick: () => zoomTo(1) },
    { label: "缩放至200%", onClick: () => zoomTo(2) },
  ];

  const iconButton = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
        active
          ? "bg-white/15 text-white"
          : "text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="absolute left-3 bottom-3 z-20 flex items-center gap-0.5 rounded-xl bg-[#1c1c1e]/95 border border-white/5 backdrop-blur p-1 shadow-2xl nodrag nopan">
      {iconButton("选择工具", true, () => {}, <MousePointer2 size={15} />)}
      {iconButton("小地图", showMiniMap, toggleMiniMap, <MapIcon size={15} />)}
      {iconButton("显示连线", showEdges, toggleEdges, <Waypoints size={15} />)}
      <div ref={menuRef} className="relative">
        <button
          aria-label="缩放选项"
          onClick={() => setZoomMenuOpen((v) => !v)}
          className="flex h-7 min-w-12 items-center justify-center rounded-lg px-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          {Math.round(zoom * 100)}%
        </button>
        <AnimatePresence>
          {zoomMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 w-52 rounded-xl bg-[#26262a] border border-white/5 p-1.5 shadow-2xl"
            >
              {zoomItems.map((item) => (
                <div key={item.label}>
                  <button
                    disabled={item.disabled}
                    onClick={() => {
                      item.onClick?.();
                      setZoomMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      item.disabled
                        ? "text-white/25 cursor-not-allowed"
                        : "text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="text-white/30">{item.shortcut}</span>
                    )}
                  </button>
                  {item.hint && (
                    <div className="px-2.5 pb-1 text-[10px] text-white/25">
                      {item.hint}
                    </div>
                  )}
                  {item.dividerAfter && (
                    <div className="mx-2 my-1 h-px bg-white/10" />
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Controls;
