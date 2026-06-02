"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ToolContextValue = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const ToolContext = React.createContext<ToolContextValue | null>(null);

const useTool = () => {
  const context = React.useContext(ToolContext);

  if (!context) {
    throw new Error("Tool components must be used inside <Tool />");
  }

  return context;
};

export const Tool = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    defaultOpen?: boolean;
  }
>(({ className, defaultOpen = false, children, ...props }, ref) => {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <ToolContext.Provider value={{ open, setOpen }}>
      <div
        ref={ref}
        className={cn(
          "overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ToolContext.Provider>
  );
});
Tool.displayName = "Tool";

export const ToolHeader = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    title?: string;
    type: string;
    state: string;
    toolName?: string;
  }
>(({ className, title, type, state, toolName, ...props }, ref) => {
  const { open, setOpen } = useTool();
  const name = title ?? toolName ?? type.replace(/^tool-/, "");

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setOpen((value) => !value)}
      className={cn(
        "flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left dark:bg-slate-900",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {name}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {state}
        </span>
        <span className="text-xs text-slate-400">{open ? "Hide" : "Show"}</span>
      </div>
    </button>
  );
});
ToolHeader.displayName = "ToolHeader";

export const ToolContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { open } = useTool();

  if (!open) {
    return null;
  }

  return (
    <div ref={ref} className={cn("space-y-3 p-4", className)} {...props} />
  );
});
ToolContent.displayName = "ToolContent";

export const ToolInput = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    input?: unknown;
  }
>(({ className, input, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props}>
    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
      Parameters
    </div>
    <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
      {JSON.stringify(input ?? {}, null, 2)}
    </pre>
  </div>
));
ToolInput.displayName = "ToolInput";

export const ToolOutput = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    output?: React.ReactNode;
    errorText?: string;
  }
>(({ className, output, errorText, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props}>
    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
      Result
    </div>
    {errorText ? (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-300">
        {errorText}
      </div>
    ) : (
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        {output}
      </div>
    )}
  </div>
));
ToolOutput.displayName = "ToolOutput";
