"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, FolderOpen, Images, Settings, Sparkles } from "lucide-react";
import type { CanvasSummary } from "@/lib/canvas-history";

export const CanvasPreview = ({ canvas, compact = false }: { canvas: CanvasSummary; compact?: boolean }) => {
  if (canvas.previewUrl && canvas.previewType === "video") {
    return <video src={canvas.previewUrl} preload="metadata" muted playsInline className="size-full object-cover" />;
  }
  if (canvas.previewUrl) return <img src={canvas.previewUrl} alt={canvas.title} className="size-full object-cover" />;
  return (
    <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:18px_18px] text-white/20">
      <Clapperboard size={compact ? 15 : 34} strokeWidth={1.3} />
    </div>
  );
};

const HomeSidebar = ({ active, canvases, loading }: {
  active: "create" | "assets";
  canvases: CanvasSummary[];
  loading: boolean;
}) => {
  const router = useRouter();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-[#151515] md:flex">
      <Link href="/home" className="flex h-20 items-center gap-3 px-6">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white text-neutral-900 shadow-lg shadow-black/20"><Sparkles size={20} /></span>
        <span className="text-lg font-semibold tracking-wide">AI 创作</span>
      </Link>
      <nav className="space-y-1 px-3">
        <Link href="/home" className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${active === "create" ? "bg-white/8 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}><Sparkles size={17} />创作</Link>
        <Link href="/assets" className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${active === "assets" ? "bg-white/8 text-white" : "text-white/55 hover:bg-white/5 hover:text-white"}`}><Images size={17} />资产和主体</Link>
        <Link href="/settings/models" className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white"><Settings size={17} />模型配置</Link>
      </nav>
      <div className="mx-6 my-5 h-px bg-white/5" />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center px-6 text-xs text-white/35"><FolderOpen size={14} className="mr-2" />我的画布<span className="ml-auto">{canvases.length}</span></div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {canvases.map((canvas) => (
            <button key={canvas.id} type="button" onClick={() => router.push(`/pipeline/${canvas.id}`)} className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/5">
              <span className="size-10 shrink-0 overflow-hidden rounded-lg border border-white/5 bg-black/30"><CanvasPreview canvas={canvas} compact /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs text-white/70">{canvas.title}</span><span className="mt-1 block text-[10px] text-white/30">{canvas.nodeCount} 个节点</span></span>
            </button>
          ))}
          {!loading && !canvases.length && <p className="px-3 py-6 text-xs leading-5 text-white/25">还没有画布，从右侧新建一个开始创作。</p>}
        </div>
      </div>
    </aside>
  );
};

export default HomeSidebar;
