"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Clapperboard,
  LayoutGrid,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AgentEmptyCopy = {
  title: string;
  subtitle?: string | null;
  starters: ReadonlyArray<{ icon: LucideIcon; text: string }>;
  hint: ReactNode | null;
};

const STARTERS = [
  { icon: Clapperboard, text: "把选中的剧本拆成分镜" },
  { icon: Users, text: "整理人物，做一份资产清单" },
  { icon: LayoutGrid, text: "把画布按场景整理整齐" },
] as const;

const DEFAULT_COPY: AgentEmptyCopy = {
  title: "让 Agent 帮你把想法搭成分镜",
  subtitle: "读懂画布、搭建节点、整理布局；生成和删除前都会先问你",
  starters: STARTERS,
  hint: (
    <>
      <kbd>⌘ /</kbd>随时唤起 · <kbd>@</kbd>引用节点 · <kbd>/</kbd>插入技能
    </>
  ),
};

export function AgentEmpty({
  onStarter,
  copy = DEFAULT_COPY,
}: {
  onStarter: (text: string) => void;
  copy?: AgentEmptyCopy;
}) {
  return (
    <div className="agent-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
      <div className="m-auto flex w-full flex-col items-center gap-1">
        <div className="mb-2 grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-zinc-600 to-zinc-800 text-white shadow-sm">
          <Sparkles className="size-5" />
        </div>
        <p className="text-center text-[15px] font-semibold tracking-[-0.01em]">
          {copy.title}
        </p>
        {copy.subtitle && (
          <p className="mb-4 max-w-[300px] text-center text-xs leading-relaxed text-zinc-500">
            {copy.subtitle}
          </p>
        )}
        <div className="my-4 flex w-full flex-col gap-1.5">
          {copy.starters.map(({ icon: Icon, text }) => (
            <motion.button
              key={text}
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => onStarter(text)}
              className="group flex h-10 items-center gap-2.5 rounded-xl border border-zinc-200 px-3 text-left text-[13px] outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              <Icon className="size-3.5 shrink-0 text-zinc-500" />
              <span className="min-w-0 flex-1 truncate">{text}</span>
              <ArrowUpRight className="size-3.5 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
