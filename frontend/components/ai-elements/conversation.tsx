"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ConversationContextValue = {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  showScrollButton: boolean;
  scrollToBottom: () => void;
};

const ConversationContext =
  React.createContext<ConversationContextValue | null>(null);

const useConversation = () => {
  const context = React.useContext(ConversationContext);

  if (!context) {
    throw new Error(
      "Conversation components must be used inside <Conversation />",
    );
  }

  return context;
};

export const Conversation = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  const scrollToBottom = React.useCallback(() => {
    const node = viewportRef.current;

    if (!node) {
      return;
    }

    node.scrollTo({
      top: node.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  React.useEffect(() => {
    const node = viewportRef.current;

    if (!node) {
      return;
    }

    const update = () => {
      const distanceToBottom =
        node.scrollHeight - node.scrollTop - node.clientHeight;
      setShowScrollButton(distanceToBottom > 80);
    };

    update();
    node.addEventListener("scroll", update, { passive: true });

    return () => node.removeEventListener("scroll", update);
  }, []);

  return (
    <ConversationContext.Provider
      value={{ viewportRef, showScrollButton, scrollToBottom }}
    >
      <div
        ref={ref}
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </ConversationContext.Provider>
  );
});
Conversation.displayName = "Conversation";

export const ConversationContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { viewportRef } = useConversation();

  return (
    <div
      ref={(node) => {
        viewportRef.current = node;

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4",
        className,
      )}
      {...props}
    />
  );
});
ConversationContent.displayName = "ConversationContent";

export const ConversationEmptyState = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    title?: string;
    description?: string;
    icon?: React.ReactNode;
  }
>(({ className, title, description, icon, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-800",
      className,
    )}
    {...props}
  >
    {icon ? <div className="text-slate-400">{icon}</div> : null}
    {title ? (
      <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </div>
    ) : null}
    {description ? (
      <div className="max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        {description}
      </div>
    ) : null}
    {children}
  </div>
));
ConversationEmptyState.displayName = "ConversationEmptyState";

export const ConversationScrollButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { showScrollButton, scrollToBottom } = useConversation();

  if (!showScrollButton) {
    return null;
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => scrollToBottom()}
      className={cn(
        "absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100",
        className,
      )}
      {...props}
    >
      {children ?? "Scroll to bottom"}
    </button>
  );
});
ConversationScrollButton.displayName = "ConversationScrollButton";
