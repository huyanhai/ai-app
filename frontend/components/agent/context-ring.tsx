"use client";

import { contextUsage, formatTokens } from "@/lib/agent/context-usage";
import { AgentPopover } from "./ui";
import { ProgressRing } from "./progress-ring";
import { AGENT_ICON_BTN } from "./styles";

export function ContextRing({
  tokens,
  window,
}: {
  tokens: number;
  window: number;
}) {
  const usage = contextUsage(tokens, window);
  const used = formatTokens(usage.used);
  const total = formatTokens(window);
  const summary = usage.known ? `${used} / ${total}` : used;
  const color =
    usage.tone === "danger"
      ? "stroke-red-500"
      : usage.tone === "warn"
        ? "stroke-amber-500"
        : "stroke-zinc-500";
  return (
    <AgentPopover
      label={`上下文用量 ${summary}`}
      side="top"
      align="end"
      className="w-[min(240px,calc(100vw-24px))] p-3"
      trigger={
        <span className={AGENT_ICON_BTN} title={`上下文 ${summary}`}>
          <ProgressRing
            value={usage.used}
            total={usage.known ? window : 0}
            className={color}
          />
        </span>
      }
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-zinc-500">上下文</p>
          <p className="text-lg font-semibold tabular-nums">{used}</p>
        </div>
        {usage.known && (
          <div className="text-right">
            <p className="text-xs text-zinc-500">上限</p>
            <p className="text-lg font-semibold tabular-nums">{total}</p>
          </div>
        )}
      </div>
      {usage.known && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full ${usage.tone === "danger" ? "bg-red-500" : usage.tone === "warn" ? "bg-amber-500" : "bg-zinc-500"}`}
              style={{ width: `${usage.ratio * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">已用 {usage.percent}%</p>
        </>
      )}
      <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
        {usage.known
          ? "快满时会自动压缩较早的对话，不影响继续使用"
          : "这个模型没有配置上下文上限"}
      </p>
    </AgentPopover>
  );
}
