"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AudioLines, Check, ListFilter, Search, SquareArrowUp, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { nanoid } from "nanoid";
import { usePipelineStore } from "@/store/pipeline-store";
import { subjectLibrary, SubjectLibraryItem } from "@/lib/subject-library";
import { canvasHistoryApi } from "@/lib/canvas-history";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import { NodeType, TAllNodes } from "./types";

const TABS = ["资产", "主体", "画布"];
const SUB_TABS = ["图片", "视频", "音频", "文档"];

// 即梦风格资产库弹窗
type PickerItem = { id: string; url: string; title: string };

const AssetModal = ({ canvasId }: { canvasId?: string }) => {
  const open = usePipelineStore((s) => s.assetModalOpen);
  const setOpen = usePipelineStore((s) => s.setAssetModalOpen);
  const { setNodes, getNodes, screenToFlowPosition } = useReactFlow<TAllNodes>();
  const subjectAssetTarget = usePipelineStore((state) => state.subjectAssetTarget);
  const [tab, setTab] = useState(TABS[0]);
  const [subTab, setSubTab] = useState(SUB_TABS[0]);
  const [subjects, setSubjects] = useState<SubjectLibraryItem[]>([]);
  const [audioAssets, setAudioAssets] = useState<PickerItem[]>([]);
  const [assetError, setAssetError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = () => {
      setSubjects(subjectLibrary.list());
    };
    load();
    window.addEventListener("subject-library-changed", load);
    return () => window.removeEventListener("subject-library-changed", load);
  }, [getNodes]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    if (subjectAssetTarget) {
      setTab(subjectAssetTarget.source === "canvas" ? "画布" : subjectAssetTarget.source === "assets" ? "资产" : "主体");
      if (subjectAssetTarget.slot === "voice") setSubTab("音频");
    }
  }, [open, subjectAssetTarget]);

  useEffect(() => {
    if (!open || subjectAssetTarget?.slot !== "voice" || !canvasId) return;
    let active = true;
    setAssetError("");
    canvasHistoryApi.generations(canvasId).then((records) => {
      if (!active) return;
      const items = records.filter((record) => record.nodeType === NodeType.AudioNode && record.url)
        .map((record) => ({ id: record.id, url: record.url, title: record.title || "未命名音频" }));
      setAudioAssets([...new Map(items.map((item) => [item.url, item])).values()]);
    }).catch((reason) => {
      if (active) setAssetError(reason instanceof Error ? reason.message : "音频资产加载失败");
    });
    return () => { active = false; };
  }, [open, subjectAssetTarget, canvasId]);

  const selectedSubjects = subjects.filter((subject) => selectedIds.has(subject.id));
  const canvasItems: PickerItem[] = subjectAssetTarget ? getNodes().flatMap((node) => {
    const expectedType = subjectAssetTarget.slot === "voice" ? NodeType.AudioNode : NodeType.ImageNode;
    if (node.type !== expectedType || !("url" in node.data) || !node.data.url) return [];
    return [{ id: node.id, url: node.data.url, title: node.data.title || (expectedType === NodeType.AudioNode ? "未命名音频" : "未命名图片") }];
  }) : [];
  const pickerItems = tab === "资产" ? audioAssets : canvasItems;
  const selectedPickerItems = pickerItems.filter((item) => selectedIds.has(item.id));
  const pickerVisible = tab === "画布" || (tab === "资产" && subjectAssetTarget?.slot === "voice" && subTab === "音频");
  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      if (subjectAssetTarget) {
        return new Set(current.has(id) ? [] : [id]);
      }
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const changeTab = (value: string) => {
    setTab(value);
    setSelectedIds(new Set());
  };

  const changeSubTab = (value: string) => {
    setSubTab(value);
    setSelectedIds(new Set());
  };

  const importSubjects = () => {
    if (!selectedSubjects.length) return;
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const imported = selectedSubjects.map((subject, index) => ({
      id: nanoid(),
      type: NodeType.ImageNode,
      position: {
        x: center.x - 210 + (index % 3) * 460,
        y: center.y - 160 + Math.floor(index / 3) * 460,
      },
      data: {
        title: subject.name,
        url: subject.url,
        status: ChunkStatus.SUCCESS,
      },
      selected: true,
    }) as TAllNodes);
    setNodes((nodes) => [
      ...nodes.map((node) => ({ ...node, selected: false })),
      ...imported,
    ]);
    setSelectedIds(new Set());
    setOpen(false);
  };

  const bindToSubject = () => {
    if (!subjectAssetTarget || !selectedIds.size) return;
    if (subjectAssetTarget.slot === "import" && tab !== "主体") return;
    const sourceItems = tab === "主体" ? selectedSubjects : selectedPickerItems;
    const urls = sourceItems.flatMap((item) => item.url ? [item.url] : []);
    if (!urls.length) return;
    setNodes((nodes) => nodes.map((node) => {
      if (node.id !== subjectAssetTarget.nodeId || node.type !== NodeType.SubjectNode) return node;
      if (subjectAssetTarget.slot === "import") {
        const subject = selectedSubjects[0];
        if (!subject) return node;
        return {
          ...node,
          data: {
            ...node.data,
            name: subject.name,
            title: subject.name,
            description: undefined,
            url: subject.url,
          },
        };
      }
      if (subjectAssetTarget.slot === "main") {
        return { ...node, data: { ...node.data, url: urls[0] } };
      }
      return { ...node, data: { ...node.data, voiceUrl: urls[0] } };
    }) as TAllNodes[]);
    setSelectedIds(new Set());
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[70vh] w-[min(880px,90vw)] flex-col rounded-2xl bg-[#1c1c1e] border border-white/10 shadow-2xl overflow-hidden"
          >
            {/* 一级 tab + 关闭 */}
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                {TABS.map((item) => (
                  <button
                    key={item}
                    disabled={(subjectAssetTarget?.slot === "import" && item === "画布") || (subjectAssetTarget?.slot === "voice" && item === "主体")}
                    onClick={() => changeTab(item)}
                    className={`rounded-md px-4 py-1.5 text-sm transition-colors disabled:opacity-30 cursor-pointer ${
                      tab === item
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                aria-label="关闭"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* 二级 tab + 搜索 */}
            <div className="mt-3 flex items-center justify-between px-4">
              {tab === "资产" && <div className="flex gap-4">
                {SUB_TABS.map((item) => (
                  <button
                    key={item}
                    onClick={() => changeSubTab(item)}
                    className={`relative pb-2 text-sm transition-colors cursor-pointer ${
                      subTab === item
                        ? "text-white after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-4 after:-translate-x-1/2 after:rounded-full after:bg-white"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>}
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-white/40">
                  <Search size={13} />
                  <input
                    placeholder="搜索"
                    className="w-32 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
                  />
                </div>
                <button
                  aria-label="导入"
                  className="flex size-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <SquareArrowUp size={15} />
                </button>
                <button
                  aria-label="筛选"
                  className="flex size-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <ListFilter size={15} />
                </button>
              </div>
            </div>

            {/* 素材网格 */}
            <div className="mt-2 flex-1 overflow-y-auto px-4 pb-4">
              {tab === "主体" && subjects.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {subjects.map((subject) => {
                  const selected = selectedIds.has(subject.id);
                  return <button
                    key={subject.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSelection(subject.id)}
                    className={`relative overflow-hidden rounded-xl border text-left transition-colors cursor-pointer ${
                      selected
                        ? "border-sky-400 bg-sky-400/10 ring-1 ring-sky-400"
                        : "border-white/8 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    <img src={subject.url} alt={subject.name} className="aspect-square w-full object-cover" />
                    {selected && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-sky-400 text-black shadow-lg"><Check size={14} strokeWidth={3} /></span>}
                    <div className="p-2.5"><p className="truncate text-xs text-white/80">{subject.name}</p></div>
                  </button>;
                })}
              </div> : pickerVisible && pickerItems.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {pickerItems.map((item) => {
                  const selected = selectedIds.has(item.id);
                  return <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSelection(item.id)}
                    className={`relative overflow-hidden rounded-xl border text-left transition-colors cursor-pointer ${selected ? "border-sky-400 bg-sky-400/10 ring-1 ring-sky-400" : "border-white/8 bg-white/[0.03] hover:border-white/20"}`}
                  >
                    {subjectAssetTarget?.slot === "voice" ? <div className="grid aspect-square w-full place-items-center bg-white/[0.02] text-white/35"><AudioLines size={32} /></div> : <img src={item.url} alt={item.title} className="aspect-square w-full object-cover" />}
                    {selected && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-sky-400 text-black shadow-lg"><Check size={14} strokeWidth={3} /></span>}
                    <div className="p-2.5"><p className="truncate text-xs text-white/80">{item.title}</p></div>
                  </button>;
                })}
              </div> : <div className="flex h-full items-center justify-center text-sm text-white/30">{assetError || "暂无素材"}</div>}
            </div>

            {/* 底部操作 */}
            <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
              <span className="text-xs text-white/40">已选择 {selectedIds.size} 个素材</span>
              <button
                disabled={!selectedIds.size}
                onClick={subjectAssetTarget ? bindToSubject : importSubjects}
                className={`rounded-lg px-5 py-2 text-sm transition-colors ${
                  selectedIds.size
                    ? "bg-white text-black hover:bg-white/90 cursor-pointer"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                确认
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AssetModal;
