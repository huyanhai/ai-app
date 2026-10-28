"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useReactFlow } from "@xyflow/react";
import { Download, Maximize2, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { TAllNodes } from "./types";

// 文本节点背景色选项（对齐即梦「背景色」）
const BG_COLORS = ["#1f1f22", "#16324a", "#1d3a2a", "#2d2440", "#3a3320"];

// 即梦风格文本节点顶部工具条：背景色 / 放大 / 下载
const TextToolbar = ({ node }: { node: TAllNodes }) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const { setNodes } = useReactFlow<TAllNodes>();
  const text = (node.data as { text?: string }).text;
  const currentBg = (node.data as { bg?: string }).bg || BG_COLORS[0];

  const setBg = (bg: string) => {
    setNodes(
      (nodes) =>
        nodes.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, bg } } : n,
        ) as TAllNodes[],
    );
    setBgOpen(false);
  };

  const download = () => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${node.data.title || "文本"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="nodrag flex items-center gap-0.5 rounded-xl bg-[#26262a] border border-white/5 p-1 shadow-2xl whitespace-nowrap">
        <div className="relative flex items-center">
          <button
            onClick={() => setBgOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <span
              className="size-3 rounded-sm border border-white/20"
              style={{ backgroundColor: currentBg }}
            />
            背景色
          </button>
          {bgOpen && (
            <div className="absolute top-full left-0 mt-2 flex gap-1.5 rounded-lg bg-[#26262a] border border-white/5 p-2 shadow-2xl">
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  aria-label={`背景色 ${color}`}
                  onClick={() => setBg(color)}
                  className={`size-5 rounded-md border transition-transform hover:scale-110 cursor-pointer ${
                    currentBg === color ? "border-white" : "border-white/20"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="mx-1 h-4 w-px bg-white/10" />
        <button
          aria-label="放大"
          onClick={() => setFullscreen(true)}
          className="flex size-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <Maximize2 size={13} />
        </button>
        <button
          aria-label="下载"
          onClick={download}
          className="flex size-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <Download size={13} />
        </button>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {fullscreen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setFullscreen(false)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="relative max-h-[70vh] w-[560px] overflow-y-auto rounded-2xl border border-white/10 p-6"
                  style={{ backgroundColor: currentBg }}
                >
                  <button
                    aria-label="关闭"
                    onClick={() => setFullscreen(false)}
                    className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                  {text ? (
                    <Markdown>{text}</Markdown>
                  ) : (
                    <span className="text-sm text-white/30">暂无内容</span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

export default TextToolbar;
