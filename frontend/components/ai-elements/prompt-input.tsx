"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type PromptInputMessage = {
  text: string;
};

type PromptInputContextValue = {
  formId: string;
  disabled?: boolean;
  status?: string;
};

const PromptInputContext = React.createContext<PromptInputContextValue | null>(
  null,
);

const usePromptInputContext = () => {
  const context = React.useContext(PromptInputContext);

  if (!context) {
    throw new Error(
      "PromptInput components must be used inside <PromptInput />",
    );
  }

  return context;
};

type PromptInputProps = Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  onSubmit?: (
    message: PromptInputMessage,
    event: React.FormEvent<HTMLFormElement>,
  ) => void;
  disabled?: boolean;
  status?: string;
};

export const PromptInput = React.forwardRef<HTMLFormElement, PromptInputProps>(
  ({ className, children, onSubmit, disabled, status, ...props }, ref) => {
    const formId = React.useId();

    return (
      <PromptInputContext.Provider value={{ formId, disabled, status }}>
        <form
          ref={ref}
          className={cn(
            "rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.32)] backdrop-blur-xl",
            "dark:border-slate-800/80 dark:bg-slate-950/85",
            className,
          )}
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const text = String(formData.get("prompt") ?? "");
            onSubmit?.({ text }, event);
          }}
          {...props}
        >
          {children}
        </form>
      </PromptInputContext.Provider>
    );
  },
);
PromptInput.displayName = "PromptInput";

export const PromptInputHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "border-b border-slate-200/70 px-5 py-3 dark:border-slate-800/70",
      className,
    )}
    {...props}
  />
));
PromptInputHeader.displayName = "PromptInputHeader";

export const PromptInputBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-4 pt-3", className)} {...props} />
));
PromptInputBody.displayName = "PromptInputBody";

export const PromptInputFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between gap-3 px-4 pb-4 pt-3",
      className,
    )}
    {...props}
  />
));
PromptInputFooter.displayName = "PromptInputFooter";

export const PromptInputTools = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-2", className)}
    {...props}
  />
));
PromptInputTools.displayName = "PromptInputTools";

export const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 1, onInput, ...props }, ref) => {
  const { disabled } = usePromptInputContext();

  return (
    <textarea
      ref={ref}
      name="prompt"
      rows={rows}
      disabled={disabled}
      className={cn(
        "max-h-56 min-h-18 w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-7 text-slate-900 outline-none placeholder:text-slate-400",
        "dark:text-slate-100 dark:placeholder:text-slate-500",
        className,
      )}
      onInput={(event) => {
        const target = event.currentTarget;
        target.style.height = "auto";
        target.style.height = `${Math.min(target.scrollHeight, 224)}px`;
        onInput?.(event);
      }}
      {...props}
    />
  );
});
PromptInputTextarea.displayName = "PromptInputTextarea";

export const PromptInputButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
  }
>(({ className, active, type = "button", ...props }, ref) => {
  const { disabled } = usePromptInputContext();

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || props.disabled}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition",
        active
          ? "border-blue-500/50 bg-blue-600 text-white shadow-md shadow-blue-600/20"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
PromptInputButton.displayName = "PromptInputButton";

export const PromptInputSubmit = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    status?: string;
  }
>(({ className, status, children, ...props }, ref) => {
  const context = usePromptInputContext();
  const currentStatus = status ?? context.status;
  const isBusy = currentStatus === "submitted" || currentStatus === "streaming";

  return (
    <button
      ref={ref}
      type="submit"
      disabled={context.disabled || props.disabled}
      className={cn(
        "inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800",
        "dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children ?? (isBusy ? "Working" : "Send")}
    </button>
  );
});
PromptInputSubmit.displayName = "PromptInputSubmit";
