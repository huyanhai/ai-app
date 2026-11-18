"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AudioLines, Check, Clock3, FolderOpen, Image, LoaderCircle, Settings, Trash2, Video, X } from "lucide-react";
import HomeSidebar from "@/components/home-sidebar";
import { canvasHistoryApi, CanvasSummary, GenerationRecord } from "@/lib/canvas-history";
import { NodeType } from "@/components/pipeline/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CATEGORIES = [
  { type: NodeType.ImageNode, label: "图片" },
  { type: NodeType.VideoNode, label: "视频" },
  { type: NodeType.AudioNode, label: "音频" },
] as const;

type Category = typeof CATEGORIES[number]["type"];

const dateLabel = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
}).format(new Date(value));

const AssetMedia = ({ record }: { record: GenerationRecord }) => {
  if (record.nodeType === NodeType.VideoNode) {
    return <video src={record.url} preload="metadata" muted playsInline className="size-full object-cover" />;
  }
  if (record.nodeType === NodeType.AudioNode) {
    return <span className="flex size-full items-center justify-center bg-white/[0.035] text-white/35"><AudioLines size={42} strokeWidth={1.3} /></span>;
  }
  return <img src={record.url} alt={record.title} className="size-full object-cover" />;
};

export default function AssetsPage() {
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [category, setCategory] = useState<Category>(NodeType.ImageNode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([canvasHistoryApi.list(), canvasHistoryApi.allGenerations()])
      .then(([canvasItems, generationItems]) => {
        setCanvases(canvasItems);
        setRecords(generationItems);
        setError("");
      })
      .catch(() => setError("资产加载失败，请确认后端服务已启动"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const canvasTitles = useMemo(() => new Map(canvases.map((canvas) => [canvas.id, canvas.title])), [canvases]);
  const groups = useMemo(() => {
    const result = new Map<string, GenerationRecord[]>();
    records.filter((record) => record.nodeType === category).forEach((record) => {
      const label = dateLabel(record.createdAt);
      result.set(label, [...(result.get(label) ?? []), record]);
    });
    return Array.from(result.entries());
  }, [category, records]);

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await canvasHistoryApi.deleteGenerations(ids);
      setRecords((current) => current.filter((record) => !selectedIds.has(record.id)));
      setSelectedIds(new Set());
      setDeleteOpen(false);
    } catch {
      setError("删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="flex h-full min-h-0 bg-[#111111] text-white">
      <HomeSidebar active="assets" canvases={canvases} loading={loading} />
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center border-b border-white/5 px-5 lg:px-8">
          <div className="flex items-center gap-5">
            <h1 className="rounded-full bg-white/8 px-4 py-2 text-sm font-medium">生成历史</h1>
            <span className="text-sm text-white/40">资产和主体</span>
          </div>
          {selectedIds.size > 0 ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="mr-2 text-xs text-white/35">已选择 {selectedIds.size} 项内容</span>
              <button type="button" onClick={() => setDeleteOpen(true)} className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-red-300 transition-colors hover:bg-red-400/10"><Trash2 size={15} />删除</button>
              <button type="button" onClick={() => setSelectedIds(new Set())} className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"><X size={15} />取消选择</button>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-3">
              <span className="flex items-center gap-2 text-xs text-white/35"><Clock3 size={14} />全部生成记录</span>
              <Link href="/settings/models" aria-label="模型配置" className="flex size-9 items-center justify-center rounded-xl text-white/45 hover:bg-white/5 hover:text-white"><Settings size={17} /></Link>
            </div>
          )}
        </header>

        <div className="flex h-14 shrink-0 items-center gap-6 border-b border-white/5 px-5 lg:px-8">
          {CATEGORIES.map((item) => (
            <button key={item.type} type="button" aria-pressed={category === item.type} onClick={() => { setCategory(item.type); setSelectedIds(new Set()); }} className={`relative h-full cursor-pointer text-sm transition-colors ${category === item.type ? "text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-white" : "text-white/40 hover:text-white"}`}>{item.label}</button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/15 bg-red-400/5 px-4 py-3 text-xs text-red-200/70">{error}</div>}
          {loading ? (
            <div className="flex h-64 items-center justify-center text-white/35"><LoaderCircle size={22} className="animate-spin" /></div>
          ) : groups.length ? groups.map(([date, items]) => (
            <section key={date} className="mb-8">
              <h2 className="mb-4 text-xl font-normal tracking-wide text-white/85">{date}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {items.map((record) => {
                  const selected = selectedIds.has(record.id);
                  return (
                    <button key={record.id} type="button" aria-pressed={selected} aria-label={`${selected ? "取消选择" : "选择"} ${record.title}`} onClick={() => toggle(record.id)} className={`group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 bg-[#1b1b1b] text-left transition-colors ${selected ? "border-white" : "border-transparent hover:border-white/30"}`}>
                      <AssetMedia record={record} />
                      <span className={`absolute left-2 top-2 grid size-5 place-items-center rounded-md border backdrop-blur-sm transition-opacity ${selected ? "border-white bg-white text-neutral-900 opacity-100" : `border-white/40 bg-black/45 text-transparent ${selectedIds.size ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}`}><Check size={13} strokeWidth={3} /></span>
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <span className="block truncate text-xs text-white/85">{record.title}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-white/40">{record.canvasId ? canvasTitles.get(record.canvasId) : record.model}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )) : (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-white/30">
              {category === NodeType.ImageNode ? <Image size={38} strokeWidth={1.2} /> : category === NodeType.VideoNode ? <Video size={38} strokeWidth={1.2} /> : <FolderOpen size={38} strokeWidth={1.2} />}
              <p className="mt-4 text-sm">当前分类还没有生成资产</p>
            </div>
          )}
        </div>
      </section>

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
        <DialogContent showCloseButton={false} className="border-white/10 bg-[#202020] text-white">
          <DialogHeader>
            <DialogTitle>删除选中的资产？</DialogTitle>
            <DialogDescription className="leading-5 text-white/40">将从生成历史中永久删除 {selectedIds.size} 项记录，不会删除画布中已经使用的节点。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 border-white/8 bg-transparent">
            <button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)} className="h-9 cursor-pointer rounded-lg px-4 text-xs text-white/55 hover:bg-white/8">取消</button>
            <button type="button" disabled={deleting} onClick={() => void deleteSelected()} className="h-9 cursor-pointer rounded-lg bg-white px-4 text-xs font-medium text-neutral-900 disabled:opacity-40">{deleting ? "删除中…" : "确认删除"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
