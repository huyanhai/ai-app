"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SourcesContextValue = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const SourcesContext = React.createContext<SourcesContextValue | null>(null);

const useSources = () => {
  const context = React.useContext(SourcesContext);

  if (!context) {
    throw new Error("Sources components must be used inside <Sources />");
  }

  return context;
};

export const Sources = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
      <SourcesContext.Provider value={{ isOpen, setIsOpen }}>
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {children}
        </div>
      </SourcesContext.Provider>
    );
  },
);
Sources.displayName = "Sources";

export const SourcesTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    count: number;
  }
>(({ className, count, children, ...props }, ref) => {
  const { isOpen, setIsOpen } = useSources();

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => setIsOpen((open) => !open)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/75 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100",
        className,
      )}
      {...props}
    >
      {children ?? `${count} sources`}
      <span className="text-[10px] text-slate-400 dark:text-slate-500">{isOpen ? "Hide" : "Show"}</span>
    </button>
  );
});
SourcesTrigger.displayName = "SourcesTrigger";

export const SourcesContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { isOpen } = useSources();

    if (!isOpen) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "grid gap-2 rounded-2xl border border-slate-200/70 bg-white/75 p-3 dark:border-slate-800 dark:bg-slate-900/70",
          className,
        )}
        {...props}
      />
    );
  },
);
SourcesContent.displayName = "SourcesContent";

export const Source = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        "block rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm transition hover:border-blue-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-blue-800",
        className,
      )}
      {...props}
    />
  ),
);
Source.displayName = "Source";
