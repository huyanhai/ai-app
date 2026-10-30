"use client";
import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// 导演工具箱弹窗共享外壳：标题 + 关闭 + 确认（对齐即梦）
// 注意必须 portal 到 body：节点工具卡在 React Flow 变换容器内，fixed 定位会失效
const ToolboxModal = ({
  open,
  title,
  onClose,
  onConfirm,
  confirmDisabled,
  width = 880,
  classNames,
  closeIconSize = 16,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  width?: number;
  // 各区域样式覆盖（按需对齐不同弹窗的设计稿）
  classNames?: {
    panel?: string;
    header?: string;
    title?: string;
    close?: string;
    footer?: string;
    confirm?: string;
  };
  closeIconSize?: number;
  children: ReactNode;
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative flex flex-col rounded-2xl bg-[#1c1c1e] border border-white/10 shadow-2xl overflow-hidden",
              classNames?.panel,
            )}
            style={{ width: `min(${width}px, 94vw)` }}
          >
            <div
              className={cn(
                "flex items-center justify-between px-6 pt-5",
                classNames?.header,
              )}
            >
              <span className={cn("text-base text-white", classNames?.title)}>
                {title}
              </span>
              <button
                aria-label="关闭"
                onClick={onClose}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer",
                  classNames?.close,
                )}
              >
                <X size={closeIconSize} />
              </button>
            </div>

            {children}

            <div
              className={cn(
                "flex justify-end px-6 pb-5 pt-2",
                classNames?.footer,
              )}
            >
              <button
                onClick={onConfirm}
                disabled={confirmDisabled}
                className={cn(
                  "rounded-full px-6 py-2 text-sm transition-colors",
                  confirmDisabled
                    ? "bg-white/10 text-white/30 cursor-not-allowed"
                    : "bg-white text-black hover:bg-white/90 cursor-pointer",
                  classNames?.confirm,
                )}
              >
                确认
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default ToolboxModal;
