"use client";

import { motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShimmerText } from "./shimmer-text";

export function AgentLoading({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      {failed ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium">会话加载失败</p>
          <p className="text-xs text-zinc-500">请检查连接后重试，已有对话不会丢失。</p>
          <Button size="sm" onClick={onRetry}><RotateCcw />重新加载</Button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-[280px] space-y-4">
          <ShimmerText>正在恢复对话…</ShimmerText>
          <div className="ml-auto h-14 w-4/5 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-20 w-full animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-10 w-3/5 animate-pulse rounded-2xl bg-zinc-100" />
        </motion.div>
      )}
    </div>
  );
}

