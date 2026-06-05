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
}

export interface IPopperRef {
  closePopper: () => void;
}

const Popper = (
  { trigger, content }: IPopperProps,
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
          className={`${CARD} backdrop-blur-xs bg-black/70 grid grid-cols-4 gap-2`}
        >
          {trigger}
        </motion.div>
      )}
    </AnimatePresence>
  );

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

  return (
    <div ref={containerRef}>
      <button
        onClick={configHandle}
        className="flex items-center text-xs text-white/60 hover:text-white/90 transition px-1 py-0.5 rounded hover:bg-white/10 gap-1 cursor-pointer"
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
