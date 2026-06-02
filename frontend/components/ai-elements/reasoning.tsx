"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ReasoningContextValue = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isStreaming?: boolean;
};

const ReasoningContext = React.createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = React.useContext(ReasoningContext);

  if (!context) {
    throw new Error("Reasoning components must be used inside <Reasoning />");
  }

  return context;
};

export const Reasoning = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    isStreaming?: boolean;
    defaultOpen?: boolean;
  }
>(({ className, isStreaming, defaultOpen, children, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(Boolean(defaultOpen));
  const visible = isOpen || Boolean(isStreaming);

  return (
    <ReasoningContext.Provider value={{ isOpen: visible, setIsOpen, isStreaming }}>
      <div
        ref={ref}
        className={cn(
          "overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100/70 dark:border-slate-800/70 dark:bg-slate-900/50",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ReasoningContext.Provider>
  );
});
Reasoning.displayName = "Reasoning";

export const ReasoningTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen, isStreaming } = useReasoning();

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200",
        className,
      )}
      onClick={() => setIsOpen((open) => !open)}
      {...props}
    >
      <span className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full bg-slate-400", isStreaming && "animate-pulse bg-blue-500")} />
        {children ?? (isStreaming ? "Thinking..." : "Reasoning")}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{isOpen ? "Hide" : "Show"}</span>
    </button>
  );
});
ReasoningTrigger.displayName = "ReasoningTrigger";

export const ReasoningContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { isOpen } = useReasoning();

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "border-t border-slate-200/70 px-4 pb-4 pt-3 text-xs leading-6 whitespace-pre-wrap text-slate-600 dark:border-slate-800/70 dark:text-slate-400",
        className,
      )}
      {...props}
    />
  );
});
ReasoningContent.displayName = "ReasoningContent";
