"use client";

import type { Ref } from "react";
import { motion } from "motion/react";
import { ArrowUp, Check, ChevronDown, Square } from "lucide-react";
import type { AgentModelDto } from "@/api/agent/type";
import type { RefNode } from "@/lib/agent/selection-refs";
import { attachmentBlockReason } from "@/lib/agent/attachments";
import { useAgentSettings } from "@/store/agent-settings";
import { cn } from "@/lib/utils";
import {
  AgentEditor,
  type AgentEditorHandle,
  type NodeOption,
} from "./agent-editor";
import { AttachPopover } from "./attach-popover";
import { ContextChips, type ContextRef } from "./context-chips";
import { ContextRing } from "./context-ring";
import { ModelPopover } from "./model-popover";
import { SkillPopover } from "./skill-popover";
import { AgentMenuButton, AgentPopover } from "./ui";
import type { AgentAttachments } from "./use-agent-attachments";
import { AGENT_BAR_BTN } from "./styles";

export type ComposerFeatures = {
  attachments?: boolean;
  mentions?: boolean;
  models?: boolean;
  skills?: boolean;
};

function AgentModelMenu({
  models,
  modelKey,
  busy,
}: {
  models: AgentModelDto[];
  modelKey: string;
  busy: boolean;
}) {
  const patch = useAgentSettings((state) => state.patch);
  const current = models.find((model) => model.key === modelKey);
  return (
    <AgentPopover
      label="Agent 模型"
      side="top"
      align="end"
      disabled={busy}
      className="w-[min(280px,calc(100vw-24px))] p-1.5"
      trigger={
        <span
          className={cn(AGENT_BAR_BTN, "min-w-0 max-w-48")}
          title={busy ? "运行中不能换模型" : "Agent 模型"}
        >
          <span className="min-w-0 truncate">{current?.name ?? "未选"}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </span>
      }
    >
      {(close) => (
        <div
          role="radiogroup"
          aria-label="Agent 模型"
          className="max-h-72 overflow-y-auto"
        >
          {models.map((model) => (
            <AgentMenuButton
              key={model.key}
              role="radio"
              aria-checked={model.key === modelKey}
              onClick={() => {
                patch({ modelKey: model.key });
                close();
              }}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-zinc-100 text-xs font-semibold">
                {model.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{model.name}</span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {model.vendor || "自定义模型"}
                  {!model.vision && " · 不能看图"}
                </span>
              </span>
              {model.key === modelKey && <Check className="size-4" />}
            </AgentMenuButton>
          ))}
        </div>
      )}
    </AgentPopover>
  );
}

export function AgentComposer({
  text,
  onTextChange,
  onSend,
  onStop,
  busy,
  sending,
  models,
  modelKey,
  context,
  selection,
  refNodes,
  editorRef,
  nodes,
  attachments,
  vision,
  features,
  placeholder,
  contextRefs,
  onRemoveContextRef,
}: {
  text: string;
  onTextChange: (text: string) => void;
  onSend: (message: string) => void;
  onStop: () => void;
  busy: boolean;
  sending: boolean;
  models: AgentModelDto[];
  modelKey: string;
  context: { tokens: number; window: number };
  selection: readonly string[];
  refNodes: readonly RefNode[];
  editorRef: Ref<AgentEditorHandle>;
  nodes: NodeOption[];
  attachments: AgentAttachments;
  vision: boolean;
  features?: ComposerFeatures;
  placeholder?: string;
  contextRefs?: readonly ContextRef[];
  onRemoveContextRef?: (id: string) => void;
}) {
  const canAttach = features?.attachments ?? true;
  const canMention = features?.mentions ?? true;
  const canPickModel = features?.models ?? true;
  const canSkill = features?.skills ?? true;
  const handle = editorRef as { current: AgentEditorHandle | null };
  const empty = !text.trim() && selection.length === 0;
  const stopMode = busy && empty;
  const blocked = attachmentBlockReason(attachments.items, vision);
  const ready = !stopMode && !empty && !blocked && !sending;
  const sendLabel = stopMode ? "停止" : (blocked ?? (busy ? "插话" : "发送"));
  const sendMessage = () => {
    const message = handle.current?.commitSelection() ?? text;
    if (ready) onSend(message);
  };
  const addAttachments = (files: ArrayLike<File> | null | undefined, kind: "image" | "document") => handle.current?.addAttachments(files, kind);

  return (
    <div className="flex flex-col gap-1.5">
      <ContextChips refs={contextRefs} onRemove={onRemoveContextRef} />
      <AgentEditor
        handleRef={editorRef}
        nodes={canMention ? nodes : []}
        selection={canMention ? selection : []}
        refNodes={refNodes}
        placeholder={
          busy
            ? "补充要求，Agent 会在下一步看到"
            : (placeholder ??
              "输入想法、剧本或上传参考，支持“/”插入技能，@ 引用节点")
        }
        onChange={onTextChange}
        onSubmit={sendMessage}
        onImages={canAttach ? (files) => addAttachments(files, "image") : undefined}
        attachments={canAttach ? attachments : undefined}
        mentions={canMention}
        skills={canSkill}
      />
      <div className="mt-3 flex min-w-0 flex-nowrap items-center gap-1 text-white/75">
        {canAttach && (
          <>
            <AttachPopover onAdd={addAttachments} vision={vision} />
            <span
              aria-hidden
              className="mx-1 h-3.5 w-px shrink-0 bg-white/10"
            />
          </>
        )}
        {canPickModel && (
          <ModelPopover onPick={(chip) => handle.current?.insertChip(chip)} />
        )}
        {canSkill && (
          <SkillPopover onPick={(chip) => handle.current?.insertChip(chip)} />
        )}
        <span className="min-w-1 flex-1" />
        <AgentModelMenu models={models} modelKey={modelKey} busy={busy} />
        <ContextRing tokens={context.tokens} window={context.window} />
        <motion.button
          type="button"
          aria-label={sendLabel}
          title={`${sendLabel} · ${stopMode ? "Esc" : "Enter"}`}
          disabled={!stopMode && !ready}
          whileTap={{ scale: 0.94 }}
          onClick={stopMode ? onStop : sendMessage}
          className={cn(
            "ml-0.5 grid size-9 shrink-0 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40",
            ready || stopMode
              ? "bg-white/85 text-[#171717] hover:bg-white"
              : "cursor-not-allowed bg-white/15 text-white/45",
          )}
        >
          {stopMode ? (
            <Square className="size-3.5 fill-current" />
          ) : sending ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <ArrowUp className="size-4.5" />
          )}
        </motion.button>
      </div>
    </div>
  );
}
