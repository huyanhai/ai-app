"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ListFilter, Search, SquareArrowUp, X } from "lucide-react";
import { usePipelineStore } from "@/store/pipeline-store";
import { subjectLibrary, SubjectLibraryItem } from "@/lib/subject-library";

const TABS = ["资产", "主体", "画布"];
const SUB_TABS = ["图片", "视频", "音频", "文档"];

// 即梦风格资产库弹窗
const AssetModal = () => {
  const open = usePipelineStore((s) => s.assetModalOpen);
  const setOpen = usePipelineStore((s) => s.setAssetModalOpen);
  const [tab, setTab] = useState(TABS[0]);
  const [subTab, setSubTab] = useState(SUB_TABS[0]);
  const [subjects, setSubjects] = useState<SubjectLibraryItem[]>([]);

  useEffect(() => {
    const load = () => setSubjects(subjectLibrary.list());
    load();
    window.addEventListener("subject-library-changed", load);
    return () => window.removeEventListener("subject-library-changed", load);
  }, []);

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
                    onClick={() => setTab(item)}
                    className={`rounded-md px-4 py-1.5 text-sm transition-colors cursor-pointer ${
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
                    onClick={() => setSubTab(item)}
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
                {subjects.map((subject) => <div key={subject.id} className="overflow-hidden rounded-xl border border-white/8 bg-white/[0.03]">
                  <img src={subject.url} alt={subject.name} className="aspect-square w-full object-cover" />
                  <div className="p-2.5"><p className="truncate text-xs text-white/80">{subject.name}</p>{subject.description && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/35">{subject.description}</p>}</div>
                </div>)}
              </div> : <div className="flex h-full items-center justify-center text-sm text-white/30">暂无素材</div>}
            </div>

            {/* 底部操作 */}
            <div className="flex items-center justify-between border-t border-white/5 px-4 py-3">
              <span className="text-xs text-white/40">已选择 0 个素材</span>
              <button
                disabled
                className="rounded-lg bg-white/10 px-5 py-2 text-sm text-white/30 cursor-not-allowed"
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
