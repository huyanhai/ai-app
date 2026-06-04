import { usePipelineStore } from "@/store/pipeline-store";
import { useClickOutSide } from "@/hooks/use-click-outside";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Placement } from "../types";
import { CARD } from "@/constants/class-names";
import Ratio from "./ratio";
import { TNodeBase } from "../types/index";

const RATIO_CONFIG: `${number}:${number}`[] = [
  "1:1",
  "9:16",
  "16:9",
  "3:4",
  "4:3",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "21:9",
];

interface IConfigProps extends TNodeBase {
  changeConfig: (config: TNodeBase["config"]) => void;
}

const Config = ({ config, changeConfig }: IConfigProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [placement, setPlacement] = useState<Placement>(Placement.Top);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // 点击外部关闭：同时排除触发按钮和 Portal 弹出层，避免点击弹出层内部误触发关闭
  useClickOutSide([containerRef, popoverRef], () => setOpen(false), open);

  const updatePopoverPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const nextPlacement = spaceAbove < 200 ? Placement.Bottom : Placement.Top;
    setPlacement(nextPlacement);

    if (nextPlacement === Placement.Top) {
      // 弹出层底部对齐触发按钮顶部，向上展开
      setPopoverStyle({
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
        width: 300,
        zIndex: 9999,
      });
    } else {
      // 弹出层顶部对齐触发按钮底部，向下展开
      setPopoverStyle({
        position: "fixed",
        left: rect.left,
        top: rect.bottom + 8,
        width: 300,
        zIndex: 9999,
      });
    }
  }, []);

  function configHandle() {
    if (!open) {
      updatePopoverPosition();
    }
    setOpen((prev) => !prev);
  }

  // 滚动或 resize 时同步位置
  useEffect(() => {
    if (!open) return;
    const sync = () => updatePopoverPosition();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open, updatePopoverPosition]);

  const popover = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: placement === Placement.Top ? 6 : -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: placement === Placement.Top ? 6 : -6 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={popoverStyle}
          className={`${CARD} backdrop-blur-xs bg-black/70 grid grid-cols-4 gap-2`}
        >
          {RATIO_CONFIG.map((item, index) => (
            <Ratio
              className={
                config?.ratio === item
                  ? "border border-white/20 bg-black/50 rounded-md"
                  : "border border-white/0 rounded-md cursor-pointer hover:border-white/20 hover:bg-white/5"
              }
              key={index}
              ratio={item}
              onClick={() => {
                changeConfig({ ratio: item });
                setOpen(false);
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={configHandle}
        className="text-xs text-white/60 hover:text-white/90 transition px-1 py-0.5 rounded hover:bg-white/10"
      >
        <span>{config?.ratio}</span>
      </button>
      {typeof document !== "undefined" && createPortal(popover, document.body)}
    </div>
  );
};

export default Config;
