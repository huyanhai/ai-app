import { AnimatePresence, motion } from "motion/react";
import React, {
  ForwardedRef,
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
} from "react";
import { Placement } from "../types";
import { CARD } from "@/constants/class-names";
import { createPortal } from "react-dom";
import { useClickOutSide } from "@/hooks/use-click-outside";
import { ChevronDown } from "lucide-react";

interface IPopperProps {
  trigger: ReactNode;
  content: ReactNode;
  preferredPlacement?: Placement;
}

export interface IPopperRef {
  closePopper: () => void;
}

const Popper = (
  { trigger, content, preferredPlacement }: IPopperProps,
  ref: ForwardedRef<IPopperRef>,
) => {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>(Placement.Top);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭：同时排除触发按钮和 Portal 弹出层，避免点击弹出层内部误触发关闭
  useClickOutSide([containerRef, popoverRef], () => setOpen(false), open);

  const updatePopoverPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const nextPlacement = preferredPlacement ?? (spaceAbove < 200 ? Placement.Bottom : Placement.Top);
    setPlacement(nextPlacement);

    if (nextPlacement === Placement.Top) {
      // 弹出层底部对齐触发按钮顶部，向上展开
      setPopoverStyle({
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
        zIndex: 9999,
      });
    } else {
      // 弹出层顶部对齐触发按钮底部，向下展开
      setPopoverStyle({
        position: "fixed",
        left: rect.left,
        top: rect.bottom + 8,
        zIndex: 9999,
      });
    }
  }, [preferredPlacement]);

  function configHandle() {
    if (!open) {
      updatePopoverPosition();
    }
    setOpen((prev) => !prev);
  }

  useImperativeHandle(ref, () => ({
    closePopper: () => setOpen(false),
  }));

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
          className={`${CARD} backdrop-blur-xs bg-black/70`}
        >
          {trigger}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // 弹层打开期间持续跟随触发按钮：节点拖拽/画布平移缩放只改变 transform，
  // 不触发 scroll/resize，需用 rAF 检测位置变化（rect 不变时不 setState）
  useEffect(() => {
    if (!open) return;
    let frame: number;
    let lastKey = "";
    const sync = () => {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const key = `${rect.left},${rect.top},${rect.width},${rect.height}`;
        if (key !== lastKey) {
          lastKey = key;
          updatePopoverPosition();
        }
      }
      frame = requestAnimationFrame(sync);
    };
    frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, [open, updatePopoverPosition]);

  return (
    <div ref={containerRef}>
      <button
        onClick={configHandle}
        className="flex items-center whitespace-nowrap text-xs text-white/60 hover:text-white/90 transition px-1 py-0.5 rounded hover:bg-white/10 gap-1 cursor-pointer"
      >
        {content}{" "}
        <ChevronDown
          size={14}
          className={`${open ? "rotate-180" : ""} transition-transform duration-300`}
        />
      </button>
      {typeof document !== "undefined" && createPortal(popover, document.body)}
    </div>
  );
};

export default forwardRef<IPopperRef, IPopperProps>(Popper);
