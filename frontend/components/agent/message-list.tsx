"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  Check,
  ChevronRight,
  CircleStop,
  Copy,
  Layers,
  Play,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { AgentController } from "@/hooks/use-agent-controller";
import type { TimelineItem } from "@/lib/agent/timeline";
import { parseMessage } from "@/lib/agent/chips";
import { contextUsage, formatTokens } from "@/lib/agent/context-usage";
import {
  anchoredScrollTop,
  trackHistoryKeys,
} from "@/lib/agent/message-scroll";
import { withRunFooters, type FlowEntry } from "@/lib/agent/run-footer";
import type { RefNode } from "@/lib/agent/selection-refs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ActivityGroup } from "./activity-group";
import type { NodeOption } from "./agent-editor";
import { ApprovalRow } from "./approval-row";
import { ContextChips } from "./context-chips";
import { InfoCard } from "./info-card";
import { Markdown } from "./markdown";
import { MessageAttachments } from "./message-attachments";
import { RunFeedback } from "./run-feedback";
import { ChangesPanel, ChangesPill, useRunChanges } from "./run-summary";
import { SelectionRefs } from "./selection-refs";
import { ShimmerText } from "./shimmer-text";
import { StatusLine } from "./status-line";
import { toast } from "./toast";
import { focusAgentNodes } from "./canvas";

const STICK_PX = 48;
const LOAD_MORE_PX = 160;

export function MessageText({ text }: { text: string }) {
  return (
    <>
      {parseMessage(text).map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <span
            key={index}
            title={`${part.chip.type}:${part.chip.id}`}
            className={cn(
              "mx-0.5 inline-flex h-5 max-w-40 items-center rounded-md px-1.5 align-middle text-xs ring-1 ring-zinc-200",
              part.chip.type === "model"
                ? "bg-blue-50 text-blue-700"
                : part.chip.type === "skill"
                  ? "bg-violet-50 text-violet-700"
                  : "bg-zinc-100",
            )}
          >
            <span className="truncate">{part.chip.name}</span>
          </span>
        ),
      )}
    </>
  );
}

export function MessageList({
  ctl,
  showThinking,
  nodes,
  refNodes,
  onScrolled,
}: {
  ctl: AgentController;
  showThinking: boolean;
  nodes: NodeOption[];
  refNodes: RefNode[];
  onScrolled: (scrolled: boolean) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const keys = ctl.timeline.map((item) => item.key);
  const [history, setHistory] = useState(() => trackHistoryKeys(null, keys));
  const historyKeys = trackHistoryKeys(history, keys);
  if (historyKeys.size !== history.size) setHistory(historyKeys);
  const reduce = useReducedMotion();
  const body = ctl.timeline.filter(
    (item) => !(item.type === "user" && item.queued === "waiting"),
  );
  const entries = withRunFooters(body);
  const lastFooterKey = entries.findLast(
    (entry) => entry.kind === "footer",
  )?.key;
  const lastHeight = useRef(0);

  const follow = () => {
    const element = scroller.current;
    if (!element) return;
    if (stuck.current) element.scrollTop = element.scrollHeight;
    else if (element.scrollHeight > lastHeight.current + 1) setShowJump(true);
    lastHeight.current = element.scrollHeight;
  };
  const firstKey = ctl.timeline[0]?.key;
  const previousFirstKey = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (
      element &&
      previousFirstKey.current !== undefined &&
      firstKey !== previousFirstKey.current &&
      !stuck.current
    ) {
      element.scrollTop = anchoredScrollTop(
        element.scrollTop,
        lastHeight.current,
        element.scrollHeight,
      );
      lastHeight.current = element.scrollHeight;
    }
    previousFirstKey.current = firstKey;
  });
  useLayoutEffect(follow);
  const canLoadOlder =
    ctl.hasMoreOlder && !ctl.loadingOlder && !ctl.olderFailed;
  useEffect(() => {
    const element = scroller.current;
    if (element && canLoadOlder && element.scrollTop < LOAD_MORE_PX)
      ctl.loadOlder();
  });
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(follow);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const jumpToBottom = () => {
    const element = scroller.current;
    if (!element) return;
    stuck.current = true;
    setShowJump(false);
    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="agent-scroll min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
        onScroll={(event) => {
          const element = event.currentTarget;
          const atBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            STICK_PX;
          stuck.current = atBottom;
          setShowJump(!atBottom);
          onScrolled(element.scrollTop > 4);
          if (canLoadOlder && element.scrollTop < LOAD_MORE_PX) ctl.loadOlder();
        }}
      >
        <div
          ref={content}
          className="relative flex flex-col gap-1 px-4 pb-2 pt-3"
        >
          {entries.map((entry) => {
            if (
              entry.kind === "item" &&
              entry.item.type === "assistant" &&
              entry.item.streaming &&
              !entry.item.text
            )
              return null;
            const fresh =
              !historyKeys.has(entry.key) &&
              !reduce &&
              !(
                entry.kind === "item" &&
                entry.item.type === "user" &&
                entry.item.steerId
              );
            return (
              <motion.div
                key={entry.key}
                initial={
                  fresh
                    ? entry.kind === "footer"
                      ? { opacity: 0 }
                      : { opacity: 0, y: 6 }
                    : false
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                {entry.kind === "footer" ? (
                  <RunFooter
                    entry={entry}
                    ctl={ctl}
                    nodes={nodes}
                    quiet={entry.key !== lastFooterKey}
                  />
                ) : (
                  <Item
                    item={entry.item}
                    copied={entry.copied}
                    ctl={ctl}
                    showThinking={showThinking}
                    refNodes={refNodes}
                  />
                )}
              </motion.div>
            );
          })}
          <AnimatePresence mode="popLayout">
            {ctl.statusLine && (
              <StatusLine key={ctl.statusLine.runId} line={ctl.statusLine} />
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
        <AnimatePresence>
          {(ctl.loadingOlder || ctl.olderFailed) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-auto flex h-7 items-center rounded-full border border-zinc-200 bg-white px-3 text-xs text-zinc-500 shadow-md"
            >
              {ctl.olderFailed ? (
                <button type="button" onClick={ctl.reload}>
                  加载失败，点击重试
                </button>
              ) : (
                <ShimmerText>加载更早的消息…</ShimmerText>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showJump && (
          <motion.button
            type="button"
            aria-label="回到底部"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 z-10 grid size-9 -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-white/15 bg-white/10 text-white/85 shadow-lg backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/15 hover:text-white"
          >
            <ArrowDown className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function RunFooter({
  entry,
  ctl,
  nodes,
  quiet,
}: {
  entry: Extract<FlowEntry, { kind: "footer" }>;
  ctl: AgentController;
  nodes: NodeOption[];
  quiet: boolean;
}) {
  if (!entry.summary)
    return (
      <RunFeedback
        runId={entry.runId}
        ctl={ctl}
        copyText={entry.copyText}
        quiet={quiet}
      />
    );
  return (
    <RunFooterWithChanges
      entry={entry}
      summary={entry.summary}
      ctl={ctl}
      nodes={nodes}
      quiet={quiet}
    />
  );
}

function RunFooterWithChanges({
  entry,
  summary,
  ctl,
  nodes,
  quiet,
}: {
  entry: Extract<FlowEntry, { kind: "footer" }>;
  summary: Extract<TimelineItem, { type: "run-summary" }>;
  ctl: AgentController;
  nodes: NodeOption[];
  quiet: boolean;
}) {
  const changes = useRunChanges(summary, ctl, nodes);
  return (
    <RunFeedback
      runId={entry.runId}
      ctl={ctl}
      copyText={entry.copyText}
      quiet={quiet}
      leading={<ChangesPill changes={changes} />}
      below={<ChangesPanel changes={changes} />}
    />
  );
}

function Item({
  item,
  copied,
  ctl,
  showThinking,
  refNodes,
}: {
  item: TimelineItem;
  copied: boolean;
  ctl: AgentController;
  showThinking: boolean;
  refNodes: RefNode[];
}) {
  switch (item.type) {
    case "user":
      if (item.steerId) return <Steer item={item} ctl={ctl} />;
      return (
        <div className="flex flex-col items-end gap-1">
          {item.steer && (
            <span className="text-[11px] text-zinc-400">插话</span>
          )}
          <SelectionRefs
            ids={item.selection}
            nodes={refNodes}
            interactive
            onFocus={(id) => focusAgentNodes([id])}
          />
          <ContextChips
            refs={
              item.pageContext
                ? [{ id: "page", label: item.pageContext.route }]
                : []
            }
          />
          <MessageAttachments items={item.attachments} />
          <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm border border-zinc-200/70 bg-zinc-100 p-2 text-[13.5px] leading-[1.7]">
            <MessageText text={item.text} />
          </div>
        </div>
      );
    case "assistant":
      return (
        <Assistant item={item} showThinking={showThinking} copied={copied} />
      );
    case "activity":
      return <ActivityGroup item={item} />;
    case "approval":
      return <ApprovalRow approvalId={item.approvalId} ctl={ctl} />;
    case "card":
      return <InfoCard card={item.card} scope={ctl.scope} />;
    case "status":
      return <StatusCard item={item} ctl={ctl} />;
    case "compaction":
      return <CompactionDivider item={item} window={ctl.context.window} />;
    case "settled":
      return (
        <div
          role="separator"
          className="flex items-center gap-2.5 text-[11.5px] text-zinc-500 my-2"
        >
          <span className="h-px flex-1 bg-zinc-200" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5">
            <Sparkles className="size-3" />
            {item.text}
          </span>
          <span className="h-px flex-1 bg-zinc-200" />
        </div>
      );
    case "plan-done":
      return (
        <p className="flex items-center gap-2 text-[13px] text-zinc-500">
          <Check className="size-3.5 text-emerald-600" />
          计划已完成（{item.total} 步）
        </p>
      );
    case "run-summary":
    case "run-feedback":
      return null;
  }
}

const STATUS_TEXT: Record<string, { title: string; hint: string }> = {
  canceled: { title: "已停止", hint: "你可以补充要求后重新开始。" },
  failed: { title: "运行失败", hint: "请稍后重试。" },
  interrupted: { title: "运行中断", hint: "可以从断点继续。" },
  timeout: { title: "运行超时", hint: "可以继续运行或换个说法重试。" },
  step_limit: { title: "已达到步数上限", hint: "继续后 Agent 会接着完成。" },
  expired: { title: "等待已过期", hint: "请重新发送消息。" },
};

function Card({
  tone,
  icon,
  children,
  actions,
}: {
  tone: "neutral" | "error";
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed",
        tone === "error"
          ? "border-red-200 bg-red-50/50"
          : "border-zinc-200 bg-zinc-50",
      )}
    >
      <div className="flex items-start gap-2">
        {icon && (
          <span
            className={cn(
              "mt-0.5 shrink-0",
              tone === "error" && "text-red-600",
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {actions && (
        <div className="flex flex-wrap justify-end gap-1.5">{actions}</div>
      )}
    </div>
  );
}

function StatusCard({
  item,
  ctl,
}: {
  item: Extract<TimelineItem, { type: "status" }>;
  ctl: AgentController;
}) {
  const text = {
    title: item.title || STATUS_TEXT[item.status]?.title || "运行结束",
    hint: item.hint || STATUS_TEXT[item.status]?.hint || "",
  };
  const canResume = ["interrupted", "step_limit", "timeout"].includes(
    item.status,
  );
  const live = ctl.state.runs[item.runId];
  const resumable = canResume && !ctl.busy && live?.status === item.status;
  const failed = item.status === "failed" || item.status === "timeout";
  return (
    <Card
      tone={failed ? "error" : "neutral"}
      icon={
        failed ? (
          <TriangleAlert className="size-4" />
        ) : (
          <CircleStop className="size-4" />
        )
      }
      actions={
        resumable && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void ctl.resume(item.runId)}
          >
            <Play />
            继续
          </Button>
        )
      }
    >
      <p className="font-medium">{text.title}</p>
      <p className="text-zinc-500">{item.error || text.hint}</p>
    </Card>
  );
}

function CompactionDivider({
  item,
  window,
}: {
  item: Extract<TimelineItem, { type: "compaction" }>;
  window: number;
}) {
  const format = (tokens: number) =>
    window > 0
      ? `${contextUsage(tokens, window).percent}%`
      : formatTokens(tokens);
  return (
    <div
      role="separator"
      tabIndex={0}
      title="聊天记录没有变，较早内容仅在 Agent 上下文中整理为摘要"
      className={cn(
        "flex items-center gap-2.5 rounded-md text-[11.5px] text-zinc-500 outline-none",
        item.failed && "text-amber-600",
      )}
    >
      <span className="h-px flex-1 bg-zinc-200" />
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {item.failed ? (
          <TriangleAlert className="size-3" />
        ) : (
          <Layers className="size-3" />
        )}
        {item.failed ? (
          "较早的对话没能整理 · 建议新开对话"
        ) : (
          <>
            已整理较早的对话 · 上下文 {format(item.before)} →{" "}
            {item.after === null ? "…" : format(item.after)}
          </>
        )}
      </span>
      <span className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}

function Steer({
  item,
  ctl,
}: {
  item: Extract<TimelineItem, { type: "user" }>;
  ctl: AgentController;
}) {
  const missed = item.queued === "missed";
  return (
    <div className="flex flex-col items-end gap-1">
      {missed && (
        <span className="flex min-h-4 items-center gap-1 text-[11px] text-amber-600">
          <TriangleAlert className="size-3" />
          运行已结束，这条没有被读取
          {item.resendable && !ctl.busy && (
            <>
              {" "}
              ·{" "}
              <button
                type="button"
                onClick={() =>
                  void ctl.send(
                    item.text,
                    item.attachments.map((attachment) => ({
                      asset_id: attachment.asset_id,
                    })),
                  )
                }
                className="underline"
              >
                作为新消息发送
              </button>
            </>
          )}
        </span>
      )}
      <MessageAttachments items={item.attachments} />
      <motion.div
        layoutId={`steer-${item.key}`}
        className={cn(
          "max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm px-3 py-2 text-[13.5px] leading-[1.7]",
          missed
            ? "border border-dashed border-amber-400 bg-amber-50"
            : "border border-zinc-200/70 bg-zinc-100",
        )}
      >
        <MessageText text={item.text} />
      </motion.div>
    </div>
  );
}

export function Assistant({
  item,
  showThinking,
  copied,
}: {
  item: Extract<TimelineItem, { type: "assistant" }>;
  showThinking: boolean;
  copied: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group relative flex flex-col gap-1">
      {showThinking && item.thinking && item.streaming && (
        <div className="text-[13px] text-zinc-500">
          <ShimmerText>思考中</ShimmerText>
        </div>
      )}
      {showThinking && item.thinking && !item.streaming && (
        <div className="text-[13px] text-zinc-500">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 hover:bg-zinc-100"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
            已思考
          </button>
          {open && (
            <p className="ml-1.5 mt-1 whitespace-pre-wrap break-words border-l border-zinc-200 pl-3 text-xs leading-relaxed">
              {item.thinking}
            </p>
          )}
        </div>
      )}
      {item.text && (
        <div className="break-words text-[13.5px] leading-[1.7] text-zinc-800">
          <Markdown text={item.text} />
        </div>
      )}
      {item.text && !item.streaming && !copied && (
        <button
          type="button"
          aria-label="复制"
          onClick={() =>
            void navigator.clipboard
              .writeText(item.text)
              .then(() => toast.success("已复制"))
              .catch(() => toast.error("复制失败"))
          }
          className="absolute bottom-0 right-0 grid size-6 place-items-center rounded-md bg-white/80 text-zinc-400 opacity-0 backdrop-blur-sm transition-opacity hover:bg-zinc-100 hover:text-zinc-800 group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <Copy className="size-3.5" />
        </button>
      )}
    </div>
  );
}
