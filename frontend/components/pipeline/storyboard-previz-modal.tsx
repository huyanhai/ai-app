"use client";

import { Image as ImageIcon, LayoutGrid, LoaderCircle, X } from "lucide-react";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import type { TAllNodes, TNodeShotTableData } from "./types";

type Props = {
  open: boolean;
  shots: TNodeShotTableData["shots"];
  nodes: TAllNodes[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: () => void;
  onLocate: (nodeId: string) => void;
};

const timeLabel = (seconds: number) => Number(seconds.toFixed(1)).toString();

export default function StoryboardPrevizModal({
  open, shots, nodes, busy, error, onClose, onCreate, onLocate,
}: Props) {
  if (!open) return null;
  let elapsed = 0;
  const frames = shots.map((shot, index) => {
    const start = elapsed;
    elapsed += shot.duration;
    const node = nodes.find((item) => item.id === `previz-${shot.id}`);
    return { shot, index, start, end: elapsed, node };
  });
  const missing = frames.filter((frame) => !frame.node).length;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        aria-label="草图故事板"
        className="flex max-h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#171719] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          <LayoutGrid size={18} className="text-white/70" />
          <div>
            <h2 className="text-sm font-medium text-white/90">草图故事板</h2>
            <p className="mt-1 text-xs text-white/40">逐格生成草图，点击画面定位节点；不会自动生成或覆盖高清分镜。</p>
          </div>
          <button aria-label="关闭故事板" onClick={onClose} className="ml-auto rounded-lg p-2 text-white/45 hover:bg-white/8 hover:text-white">
            <X size={18} />
          </button>
        </header>
        <div className="nowheel grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-2 xl:grid-cols-4">
          {frames.map(({ shot, index, start, end, node }) => {
            const image = node && "url" in node.data ? node.data.url : "";
            const status = node && "status" in node.data ? node.data.status : undefined;
            return (
              <button
                key={shot.id}
                onClick={() => node && onLocate(node.id)}
                disabled={!node}
                className="group overflow-hidden rounded-xl border border-white/10 bg-[#202023] text-left disabled:cursor-default"
              >
                <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2 text-xs">
                  <span className="font-semibold text-white/90">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-white/45">{timeLabel(start)}–{timeLabel(end)}s</span>
                  <span className="ml-auto max-w-[55%] truncate text-white/55">{shot.title}</span>
                </div>
                <div className="relative aspect-video bg-[#111113]">
                  {image ? (
                    <img src={image} alt={shot.title} className="size-full object-contain transition group-hover:opacity-90" />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-white/30">
                      {status === ChunkStatus.PROCESSING ? <LoaderCircle size={24} className="animate-spin" /> : <ImageIcon size={24} />}
                      <span className="text-xs">{status === ChunkStatus.PROCESSING ? "正在生成草图" : node ? "点击节点生成" : "尚未创建草图节点"}</span>
                    </div>
                  )}
                </div>
                <p className="line-clamp-2 min-h-10 px-3 py-2 text-xs leading-5 text-white/45">{shot.description}</p>
              </button>
            );
          })}
        </div>
        <footer className="flex items-center gap-3 border-t border-white/8 px-5 py-4">
          <span className="text-xs text-white/40">{frames.length} 个镜头 · 总时长 {timeLabel(elapsed)} 秒</span>
          {error && <span className="text-xs text-red-300">{error}</span>}
          {missing > 0 && (
            <button onClick={onCreate} disabled={busy} className="ml-auto rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-white/85 disabled:opacity-50">
              {busy ? "正在创建…" : `创建 ${missing} 个草图节点`}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
