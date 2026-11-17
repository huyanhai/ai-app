"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_POP } from "./styles";

export function AgentPopover({
  trigger,
  children,
  label,
  align = "start",
  side = "bottom",
  className,
  disabled,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  label: string;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0 flex">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="contents"
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={label}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: side === "top" ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className={cn(
              AGENT_POP,
              "absolute w-max max-w-[calc(100vw-24px)]",
              align === "end" ? "right-0" : "left-0",
              side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]",
              className,
            )}
          >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AgentSwitch({
  checked,
  onCheckedChange,
  id,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40",
        checked ? "bg-zinc-900" : "bg-zinc-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function AgentMenuButton({
  active,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40",
        active && "bg-zinc-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function AgentSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const listId = useId();
  return (
    <AgentPopover
      label={label}
      align="end"
      side="top"
      className="w-[min(280px,calc(100vw-24px))] p-1.5"
      trigger={
        <span className={cn("flex min-w-0 items-center gap-1", className)}>
          <span className="truncate">{options.find((item) => item.value === value)?.label ?? "未选择"}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </span>
      }
    >
      {(close) => (
        <div role="listbox" id={listId} aria-label={label} className="max-h-72 overflow-y-auto">
          {options.map((option) => (
            <AgentMenuButton
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                close();
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {option.hint && <span className="block truncate text-[11px] text-zinc-500">{option.hint}</span>}
              </span>
              {option.value === value && <Check className="size-4 shrink-0" />}
            </AgentMenuButton>
          ))}
        </div>
      )}
    </AgentPopover>
  );
}

