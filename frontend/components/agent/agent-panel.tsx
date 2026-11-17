"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AgentModelDto } from "@/api/agent/type";
import type { AgentController } from "@/hooks/use-agent-controller";
import type { RefNode } from "@/lib/agent/selection-refs";
import { cn } from "@/lib/utils";
import { DOCK_WIDTH, useAgentSettings } from "@/store/agent-settings";
import { AgentComposer, type ComposerFeatures } from "./agent-composer";
import type { AgentEditorHandle, NodeOption } from "./agent-editor";
import { AgentEmpty, type AgentEmptyCopy } from "./agent-empty";
import { AgentHeader } from "./agent-header";
import { AgentLoading } from "./agent-loading";
import type { ContextRef } from "./context-chips";
import { MessageList } from "./message-list";
import { RunStrip } from "./run-strip";
import { SteerTray } from "./steer-tray";
import { AgentToastHost } from "./toast";
import { toAttachmentsPayload, useAgentAttachments, type AttachmentUploader } from "./use-agent-attachments";
import { WatchStrip } from "./watch-strip";

const RESIZE_STEP = 16;
const clampPanelWidth = (width: number) => Math.round(Math.max(DOCK_WIDTH.min, Math.min(DOCK_WIDTH.max, window.innerWidth - 32, width)));

function useWindowWidth() {
  const [width, setWidth] = useState(0);
  useEffect(() => { const update = () => setWidth(window.innerWidth); update(); window.addEventListener("resize", update); return () => window.removeEventListener("resize", update); }, []);
  return width;
}

export function AgentPanel({
  ctl,
  models,
  selection,
  nodes,
  refNodes,
  onClose,
  variant = "floating",
  label = "画布 Agent",
  emptyCopy,
  features,
  placeholder,
  contextRefs,
  onRemoveContextRef,
  closeShortcut,
  mascot,
  uploadAttachment,
}: {
  ctl: AgentController;
  models: AgentModelDto[];
  selection: readonly string[];
  nodes: NodeOption[];
  refNodes: RefNode[];
  onClose?: () => void;
  variant?: "floating" | "embedded";
  label?: string;
  emptyCopy?: AgentEmptyCopy;
  features?: ComposerFeatures;
  placeholder?: string;
  contextRefs?: readonly ContextRef[];
  onRemoveContextRef?: (id: string) => void;
  closeShortcut?: string;
  mascot?: ReactNode;
  uploadAttachment?: AttachmentUploader;
}) {
  const windowWidth = useWindowWidth();
  const mobile = windowWidth > 0 && windowWidth < 768;
  const reduce = useReducedMotion();
  const showThinking = useAgentSettings((state) => state.showThinking);
  const storedWidth = useAgentSettings((state) => state.dockWidth);
  const width = windowWidth ? clampPanelWidth(storedWidth) : DOCK_WIDTH.default;
  const embedded = variant === "embedded";
  const [text, setText] = useState("");
  const attachments = useAgentAttachments(uploadAttachment);
  const vision = (models.find((model) => model.key === ctl.modelKey) ?? models[0])?.vision ?? true;
  const editor = useRef<AgentEditorHandle>(null);
  const scope = useRef<HTMLDivElement>(null);

  const send = async (message: string) => {
    const ok = await ctl.send(message, toAttachmentsPayload(attachments.items));
    if (ok) { editor.current?.clear(); attachments.clear(); }
    return ok;
  };
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape" || !ctl.busy || ctl.pending || text.trim()) return;
    if (!scope.current?.contains(event.target as Node)) return;
    event.preventDefault();
    void ctl.stop();
  };
  const loading = ctl.opening || ctl.openFailed;
  const empty = ctl.timeline.length === 0 && !ctl.busy && !loading;
  const steerQueue = ctl.timeline.flatMap((item) => item.type === "user" && item.queued === "waiting" ? [{ key: item.key, text: item.text, images: item.attachments.length }] : []);
  const enter = reduce ? { opacity: 0 } : mobile ? { opacity: 0, y: 24 } : { opacity: 0, y: 8 };
  const exit = reduce ? { opacity: 0 } : mobile ? { opacity: 0, y: 24 } : { opacity: 0, y: 8 };

  const body = <>
    <AgentHeader ctl={ctl} title={ctl.session?.title ?? "新对话"} onClose={onClose} closeShortcut={closeShortcut} />
    {loading ? <AgentLoading failed={ctl.openFailed} onRetry={ctl.reload} /> : empty ? <AgentEmpty copy={emptyCopy} onStarter={(starter) => { editor.current?.setText(starter); editor.current?.focus(); }} /> : <MessageList key={ctl.session?.id ?? "new"} ctl={ctl} showThinking={showThinking} nodes={nodes} refNodes={refNodes} onScrolled={() => {}} />}
    {ctl.watch && <WatchStrip summary={ctl.watch} onCancel={() => void ctl.cancelWatch()} />}
    <div className={cn("relative shrink-0 p-3", mascot && "mt-9")}>
      {mascot && <div aria-hidden className="pointer-events-none absolute bottom-full right-5 h-11 [clip-path:inset(-48px_-24px_0_-24px)]">{mascot}</div>}
      <div className="rounded-[22px] border border-white/10 bg-[#101010] p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
        <AnimatePresence initial={false}>{ctl.strip && <RunStrip key={ctl.strip.runId} strip={ctl.strip} onHide={ctl.hidePlan} />}</AnimatePresence>
        <SteerTray items={steerQueue} />
        <AgentComposer text={text} onTextChange={setText} onSend={() => void send(text)} onStop={() => void ctl.stop()} busy={ctl.busy} sending={ctl.sending} models={models} modelKey={ctl.modelKey} context={ctl.context} selection={selection} refNodes={refNodes} editorRef={editor} nodes={nodes} attachments={attachments} vision={vision} features={features} placeholder={placeholder} contextRefs={contextRefs} onRemoveContextRef={onRemoveContextRef} />
      </div>
    </div>
    <AgentToastHost />
  </>;

  if (embedded) return <div ref={scope} role="region" aria-label={label} onKeyDown={onKeyDown} className="agent-dark @container relative flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-white/10 bg-[#171717] text-white">{body}</div>;

  return <motion.div
    ref={scope}
    role="dialog"
    aria-modal="false"
    aria-label={label}
    onKeyDown={onKeyDown}
    initial={enter}
    animate={{ opacity: 1, y: 0 }}
    exit={exit}
    transition={{ duration: 0.18, ease: "easeOut" }}
    style={mobile ? undefined : { width, maxWidth: "calc(100% - 2rem)" }}
    className={cn("agent-dark nodrag nopan @container pointer-events-auto z-30 flex flex-col overflow-hidden border border-white/10 bg-[#171717] text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]", mobile ? "fixed inset-x-2 bottom-2 h-[82%] rounded-t-[28px]" : "absolute bottom-4 right-4 h-[calc(100%-2rem)] rounded-[28px]")}
  >
    {!mobile && <PanelResizer width={width} onChange={(next) => useAgentSettings.getState().patch({ dockWidth: next })} />}
    {body}
  </motion.div>;
}

function PanelResizer({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  return <div
    role="separator"
    aria-label="调整会话面板宽度"
    aria-orientation="vertical"
    aria-valuemin={DOCK_WIDTH.min}
    aria-valuemax={DOCK_WIDTH.max}
    aria-valuenow={width}
    tabIndex={0}
    onPointerDown={(event) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width };
    }}
    onPointerMove={(event) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      onChange(clampPanelWidth(current.startWidth + current.startX - event.clientX));
    }}
    onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }}
    onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); onChange(clampPanelWidth(width + RESIZE_STEP)); }
      if (event.key === "ArrowRight") { event.preventDefault(); onChange(clampPanelWidth(width - RESIZE_STEP)); }
    }}
    className="absolute inset-y-0 left-0 z-40 w-2 cursor-ew-resize touch-none border-l border-transparent outline-none transition-colors hover:border-white/50 focus-visible:border-white/60"
  />;
}
