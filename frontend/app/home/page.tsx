"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Clapperboard, Clock3, Copy, FolderOpen, Layers3, MoreHorizontal, Pencil, Plus, Settings, Sparkles, Trash2, Video } from "lucide-react";
import { canvasHistoryApi, CanvasSummary } from "@/lib/canvas-history";
import { useClickOutSide } from "@/hooks/use-click-outside";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GenerationComposer from "@/components/generation/generation-composer";

const formatTime = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
}).format(new Date(value));

const CanvasPreview = ({ canvas, compact = false }: { canvas: CanvasSummary; compact?: boolean }) => {
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

const CanvasCard = ({ canvas, onRename, onDuplicate, onDelete }: {
  canvas: CanvasSummary;
  onRename: (canvas: CanvasSummary) => void;
  onDuplicate: (canvas: CanvasSummary) => void;
  onDelete: (canvas: CanvasSummary) => void;
}) => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutSide(menuRef, () => setMenuOpen(false), menuOpen);

  return (
    <div className="group relative aspect-[16/9] rounded-2xl border border-white/8 bg-[#202020] shadow-lg transition-all hover:-translate-y-0.5 hover:border-white/25 hover:shadow-black/30">
      <button type="button" onClick={() => router.push(`/pipeline/${canvas.id}`)} className="absolute inset-0 size-full cursor-pointer overflow-hidden rounded-2xl text-left">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.025]"><CanvasPreview canvas={canvas} /></div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-3 pt-10">
          <div className="truncate pr-8 text-sm font-medium text-white/90">{canvas.title}</div>
          <div className="mt-1 pr-8 text-[10px] text-white/40">{canvas.nodeCount} 个节点 · {formatTime(canvas.updatedAt)}</div>
        </div>
      </button>
      <div ref={menuRef} className="absolute bottom-3 right-3 z-20">
        <button type="button" aria-label={`管理画布 ${canvas.title}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/45 text-white/55 backdrop-blur-sm transition-colors hover:bg-black/65 hover:text-white">
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div className="absolute bottom-full right-0 mb-2 w-36 rounded-xl border border-white/10 bg-[#242424] p-1.5 shadow-2xl">
            <button type="button" onClick={() => { setMenuOpen(false); onRename(canvas); }} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/8 hover:text-white"><Pencil size={14} />重命名</button>
            <button type="button" onClick={() => { setMenuOpen(false); onDuplicate(canvas); }} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/70 hover:bg-white/8 hover:text-white"><Copy size={14} />复制项目</button>
            <button type="button" onClick={() => { setMenuOpen(false); onDelete(canvas); }} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/55 hover:bg-white/8 hover:text-white"><Trash2 size={14} />删除</button>
          </div>
        )}
      </div>
    </div>
  );
};

type CanvasDialog = { type: "rename" | "delete"; canvas: CanvasSummary };

export default function Home() {
  const router = useRouter();
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState("");
  const [dialog, setDialog] = useState<CanvasDialog | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"generate" | "canvas">("canvas");

  const loadCanvases = useCallback(() => {
    canvasHistoryApi.list()
      .then(setCanvases)
      .catch(() => setError("画布列表加载失败，请确认后端服务已启动"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(loadCanvases, [loadCanvases]);

  const createCanvas = async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const canvas = await canvasHistoryApi.create();
      router.push(`/pipeline/${canvas.id}`);
    } catch {
      setError("新建画布失败，请稍后重试");
      setCreating(false);
    }
  };

  const renameCanvas = async () => {
    if (dialog?.type !== "rename" || !title.trim()) return;
    setPendingId(dialog.canvas.id);
    setError("");
    try {
      const updated = await canvasHistoryApi.rename(dialog.canvas.id, title);
      setCanvases((current) => current.map((canvas) => canvas.id === updated.id ? updated : canvas));
      setDialog(null);
    } catch {
      setError("重命名失败，请稍后重试");
    } finally {
      setPendingId("");
    }
  };

  const duplicateCanvas = async (canvas: CanvasSummary) => {
    setPendingId(canvas.id);
    setError("");
    try {
      const duplicated = await canvasHistoryApi.duplicate(canvas.id);
      setCanvases((current) => [duplicated, ...current]);
    } catch {
      setError("复制画布失败，请稍后重试");
    } finally {
      setPendingId("");
    }
  };

  const deleteCanvas = async () => {
    if (dialog?.type !== "delete") return;
    setPendingId(dialog.canvas.id);
    setError("");
    try {
      await canvasHistoryApi.delete(dialog.canvas.id);
      setCanvases((current) => current.filter((canvas) => canvas.id !== dialog.canvas.id));
      setDialog(null);
    } catch {
      setError("删除画布失败，请稍后重试");
    } finally {
      setPendingId("");
    }
  };

  return (
    <main className="flex h-full min-h-0 bg-[#111111] text-white">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-[#151515] md:flex">
        <Link href="/home" className="flex h-20 items-center gap-3 px-6">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white text-neutral-900 shadow-lg shadow-black/20"><Sparkles size={20} /></span>
          <span className="text-lg font-semibold tracking-wide">AI 创作</span>
        </Link>
        <nav className="space-y-1 px-3">
          <Link href="/home" className="flex h-11 items-center gap-3 rounded-xl bg-white/8 px-3 text-sm text-white"><Sparkles size={17} className="text-white/75" />创作</Link>
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

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-end px-5 lg:px-8">
          <span className="flex items-center gap-2 text-xs text-white/40"><Clock3 size={14} />最近编辑</span>
          <Link href="/settings/models" className="ml-4 flex size-9 items-center justify-center rounded-xl text-white/45 hover:bg-white/5 hover:text-white"><Settings size={17} /></Link>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-5 pb-12 pt-5 lg:px-10 lg:pt-8">
            <div className="text-center">
              <h1 className="text-2xl font-medium tracking-wide lg:text-[28px]">你好，今天想要创作什么？</h1>
              <div className="mx-auto mt-6 flex w-fit rounded-full bg-black/25 p-1">
                <button type="button" aria-pressed={activeTab === "generate"} onClick={() => setActiveTab("generate")} className={`h-9 w-28 cursor-pointer rounded-full text-sm ${activeTab === "generate" ? "bg-white font-medium text-neutral-900 shadow" : "text-white/45 hover:text-white"}`}>生成</button>
                <button type="button" aria-pressed={activeTab === "canvas"} onClick={() => setActiveTab("canvas")} className={`h-9 w-28 cursor-pointer rounded-full text-sm ${activeTab === "canvas" ? "bg-white font-medium text-neutral-900 shadow" : "text-white/45 hover:text-white"}`}>画布</button>
              </div>
            </div>

            {activeTab === "generate" ? <GenerationComposer onCreated={(job) => router.push(`/generate/${job.id}`)} className="mx-auto mt-10 w-full max-w-6xl" /> : <>
            <div className="mt-9 flex items-end justify-between">
              <div><h2 className="text-sm font-medium text-white/85">最近画布</h2><p className="mt-1 text-xs text-white/30">点击卡片继续上次创作</p></div>
              <span className="text-xs text-white/30">全部 {canvases.length}</span>
            </div>
            {error && <div role="alert" className="mt-4 rounded-xl border border-red-400/15 bg-red-400/5 px-4 py-3 text-xs text-red-200/70">{error}</div>}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <button type="button" disabled={creating} onClick={createCanvas} className="group aspect-[16/9] cursor-pointer overflow-hidden rounded-2xl border border-white/8 bg-[#191919] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:18px_18px] transition-all hover:-translate-y-0.5 hover:border-white/20 disabled:cursor-wait disabled:opacity-60">
                <span className="flex size-full flex-col items-center justify-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-neutral-900 shadow-xl transition-transform group-hover:scale-105"><Plus size={23} /></span>
                  <span className="text-sm text-white/75">{creating ? "正在创建…" : "新建画布"}</span>
                </span>
              </button>
              {loading && Array.from({ length: 3 }, (_, index) => <div key={index} className="aspect-[16/9] animate-pulse rounded-2xl bg-white/5" />)}
              {!loading && canvases.map((canvas) => (
                <CanvasCard key={canvas.id} canvas={canvas} onRename={(item) => { setTitle(item.title); setDialog({ type: "rename", canvas: item }); }} onDuplicate={duplicateCanvas} onDelete={(item) => setDialog({ type: "delete", canvas: item })} />
              ))}
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                { icon: Layers3, title: "自由画布", description: "串联参考图、提示词、预演与生成节点" },
                { icon: Box, title: "3D 导演台", description: "设计角色动作、移动路径和相机运镜" },
                { icon: Video, title: "视频创作", description: "从几何预演与参考素材生成完整成片" },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-gradient-to-br from-white/[0.055] to-transparent p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/6 text-white/60"><item.icon size={21} /></span>
                  <div><h3 className="text-sm text-white/75">{item.title}</h3><p className="mt-1 text-xs leading-5 text-white/30">{item.description}</p></div>
                </div>
              ))}
            </div>
            </>}
          </div>
        </div>
      </section>
      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open && !pendingId) setDialog(null); }}>
        <DialogContent showCloseButton={false} className="border-white/10 bg-[#202020] text-white">
          {dialog?.type === "rename" ? (
            <form onSubmit={(event) => { event.preventDefault(); void renameCanvas(); }}>
              <DialogHeader><DialogTitle>重命名画布</DialogTitle><DialogDescription className="text-white/40">输入新的画布名称。</DialogDescription></DialogHeader>
              <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} className="mt-5 h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-white/30" />
              <DialogFooter className="mt-5 border-white/8 bg-transparent"><button type="button" disabled={Boolean(pendingId)} onClick={() => setDialog(null)} className="h-9 rounded-lg px-4 text-xs text-white/55 hover:bg-white/8">取消</button><button type="submit" disabled={Boolean(pendingId) || !title.trim()} className="h-9 rounded-lg bg-white px-4 text-xs font-medium text-neutral-900 disabled:opacity-40">{pendingId ? "保存中…" : "保存"}</button></DialogFooter>
            </form>
          ) : dialog?.type === "delete" ? (
            <>
              <DialogHeader><DialogTitle>删除画布？</DialogTitle><DialogDescription className="leading-5 text-white/40">将永久删除“{dialog.canvas.title}”及其项目数据，此操作无法撤销。</DialogDescription></DialogHeader>
              <DialogFooter className="mt-5 border-white/8 bg-transparent"><button type="button" disabled={Boolean(pendingId)} onClick={() => setDialog(null)} className="h-9 rounded-lg px-4 text-xs text-white/55 hover:bg-white/8">取消</button><button type="button" disabled={Boolean(pendingId)} onClick={() => void deleteCanvas()} className="h-9 rounded-lg bg-white px-4 text-xs font-medium text-neutral-900 disabled:opacity-40">{pendingId ? "删除中…" : "确认删除"}</button></DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
