"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

type Toast = { id: number; text: string; tone: "success" | "error" | "warning" | "info" };
const EVENT = "agent-toast";

function show(text: string, tone: Toast["tone"]) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, tone } }));
}

export const toast = {
  success: (text: string) => show(text, "success"),
  error: (text: string) => show(text, "error"),
  warning: (text: string) => show(text, "warning"),
  info: (text: string) => show(text, "info"),
};

export function AgentToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ text: string; tone: Toast["tone"] }>).detail;
      const item = { ...detail, id: Date.now() + Math.random() };
      setItems((current) => [...current.slice(-2), item]);
      window.setTimeout(() => setItems((current) => current.filter((entry) => entry.id !== item.id)), 2600);
    };
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-3 z-[100] flex flex-col items-center gap-1.5">
      <AnimatePresence>
        {items.map((item) => {
          const Icon = item.tone === "success" ? CircleCheck : item.tone === "info" ? Info : CircleAlert;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex max-w-full items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg"
            >
              <Icon className="size-3.5 shrink-0" />
              <span>{item.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

