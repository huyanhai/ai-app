"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export const Suggestions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-wrap gap-2", className)} {...props} />
  ),
);
Suggestions.displayName = "Suggestions";

export const Suggestion = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
    suggestion: string;
    onClick?: (suggestion: string) => void;
  }
>(({ className, suggestion, onClick, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    onClick={() => onClick?.(suggestion)}
    className={cn(
      "rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100",
      className,
    )}
    {...props}
  >
    {suggestion}
  </button>
));
Suggestion.displayName = "Suggestion";
