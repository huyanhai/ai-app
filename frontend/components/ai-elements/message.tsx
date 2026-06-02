import * as React from "react";

import { cn } from "@/lib/utils";

export const Message = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { from?: string }
>(({ className, from = "user", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex w-full",
      from === "user" ? "justify-end" : "justify-start",
      className,
    )}
    {...props}
  />
));
Message.displayName = "Message";

export const MessageContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "max-w-[85%] rounded-2xl px-4 py-3",
      "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100",
      className,
    )}
    {...props}
  />
));
MessageContent.displayName = "MessageContent";

export const MessageResponse = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "prose prose-slate max-w-none wrap-break-word text-sm dark:prose-invert",
      className,
    )}
    {...props}
  />
));
MessageResponse.displayName = "MessageResponse";

export const MessageActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-2 flex items-center gap-1.5 pl-2", className)}
    {...props}
  />
));
MessageActions.displayName = "MessageActions";

export const MessageAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label?: string;
    tooltip?: string;
  }
>(({ className, label, tooltip, children, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    title={tooltip ?? label}
    aria-label={label}
    className={cn(
      "inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-xs text-slate-600 transition hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-slate-100",
      className,
    )}
    {...props}
  >
    {children}
    {label ? <span>{label}</span> : null}
  </button>
));
MessageAction.displayName = "MessageAction";
