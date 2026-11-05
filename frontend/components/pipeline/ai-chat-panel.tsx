"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  Minimize2,
  MessageSquarePlus,
  Pencil,
  Palette,
  Plus,
  Shuffle,
  SlidersHorizontal,
  Square,
  Trash2,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { AttachmentFile } from "@/components/chat/attachments";
import { SubjectReference } from "@/components/chat/types";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useClickOutSide } from "@/hooks/use-click-outside";
import {
  getTextModel,
  isModelReady,
  useModelStore,
} from "@/store/model-store";
import { ModelCategory } from "@/components/models/types";
import Editor, { type IEditorRef } from "./editor";
import type { EditorToken } from "./editor/nodes";
import OptionPopper from "./option-popper";
import ReferencePicker from "./reference-picker";
import { IconButton } from "@/components/ui/icon-button";
import { useProduction } from "./hooks/use-production";
import ProductionTimeline, { ProductionStreamingPreview } from "./production-timeline";
import VideoStylePicker, { getVideoStylePrompt, VIDEO_STYLES, type VideoStyleId } from "./video-style-picker";
import type { Edge } from "@xyflow/react";
import type { TAllNodes } from "./types";

const CREATION_MODES = [
  "全流程广告片导演",
  "剧本开发",
  "剧情短片",
] as const;

const CREATION_MODE_DESCRIPTIONS: Record<(typeof CREATION_MODES)[number], string> = {
  全流程广告片导演: "从广告创意到成片，逐阶段确认制作",
  剧本开发: "完善故事设定、人物冲突与分集大纲",
  剧情短片: "快速生成短剧剧本与视觉制作方案",
};

const CREATION_MODE_TOKEN_PREFIX = "creation-mode:";
const VIDEO_STYLE_TOKEN_PREFIX = "video-style:";

interface AIChatPanelProps {
  onClose: () => void;
  subjects: SubjectReference[];
  width: number;
  onWidthChange: (width: number) => void;
  getProductionGraph: () => { nodes: TAllNodes[]; edges: Edge[] };
  applyProductionGraph: (nodes: TAllNodes[], edges: Edge[]) => void;
}

type PendingAttachment = AttachmentFile & { tokenId: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const fileUrl = (url: string) =>
  url.startsWith("/") ? `${API_BASE}${url}` : url;

const ProductionSelectionTags = ({ tokens }: { tokens: EditorToken[] }) => tokens.length > 0 ? (
  <div className="mb-2 flex flex-wrap gap-1.5">
    {tokens.map((token) => {
      const Icon = token.kind === "style" ? Palette : Shuffle;
      return <span key={token.id} className="inline-flex items-center gap-1 rounded-md bg-white/8 px-1.5 py-0.5 text-xs text-white/65"><Icon size={12} />{token.label}</span>;
    })}
  </div>
) : null;

export default function AIChatPanel({ onClose, subjects, width, onWidthChange, getProductionGraph, applyProductionGraph }: AIChatPanelProps) {
  const [text, setText] = useState("");
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedVideoStyle, setSelectedVideoStyle] = useState<VideoStyleId>("");
  const [videoStyleOpen, setVideoStyleOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [revisionStage, setRevisionStage] = useState<"requirements" | "script" | "characters" | "storyboard" | "imagePrompts" | "videoPrompts" | null>(null);
  const [pendingProductionIdea, setPendingProductionIdea] = useState("");
  const [pendingProductionTokens, setPendingProductionTokens] = useState<EditorToken[]>([]);
  const [productionIdeaInCard, setProductionIdeaInCard] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectReference[]>([]);
  const [mode, setMode] = useState<"agent" | "chat">("agent");
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [referenceMenuPosition, setReferenceMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const editorRef = useRef<IEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const sessionMenuRef = useRef<HTMLDivElement>(null);
  const skillMenuRef = useRef<HTMLDivElement>(null);
  const models = useModelStore((state) => state.models);
  const loadModels = useModelStore((state) => state.loadModels);
  const {
    sessions,
    currentSessionId,
    messages,
    isLoading,
    error,
    send,
    stop,
    selectSession,
    createSession,
    renameSession,
    deleteSession,
  } = useAgentChat();
  const {
    project: production,
    isPlanning,
    isAdvancing,
    streamPreview,
    error: productionError,
    plan: planProduction,
    confirmStage,
    reviseStage: reviseProduction,
    confirm: confirmProduction,
    startPhase: startMediaPhase,
    pause: pauseProduction,
    retry: retryProduction,
    reset: resetProduction,
    stop: stopProduction,
  } = useProduction({ getGraph: getProductionGraph, applyGraph: applyProductionGraph });
  const textModels = models.filter(
    (model) => model.category === ModelCategory.Text && model.enabled,
  );
  const selectedModel = textModels.find((model) => model.id === selectedModelId);
  const currentTitle =
    sessions.find((session) => session.id === currentSessionId)?.title ??
    "新会话";
  const revisionLabel = { requirements: "需求", script: "剧本", characters: "角色", storyboard: "分镜", imagePrompts: "分镜图提示词", videoPrompts: "视频提示词" }[revisionStage ?? "script"];

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  useEffect(() => {
    if (selectedModelId && textModels.some((model) => model.id === selectedModelId)) {
      return;
    }
    setSelectedModelId(getTextModel()?.id ?? "");
  }, [selectedModelId, textModels]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, production?.events.length, isPlanning, isAdvancing]);

  useClickOutSide(sessionMenuRef, () => setSessionMenuOpen(false), sessionMenuOpen);
  useClickOutSide(skillMenuRef, () => setSkillMenuOpen(false), skillMenuOpen);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const selectMode = (mode: string) => {
    const tokens = editorRef.current?.getContent()?.tokens ?? [];
    tokens.forEach((token) => {
      if (token.id.startsWith(CREATION_MODE_TOKEN_PREFIX)) {
        editorRef.current?.removeToken(token.id);
      }
    });
    editorRef.current?.insertToken({
      id: `${CREATION_MODE_TOKEN_PREFIX}${mode}`,
      kind: "skill",
      label: mode,
    });
    setSkillMenuOpen(false);
  };

  const handleSend = () => {
    const content = editorRef.current?.getContent();
    if (!content?.text || !selectedModel || !isModelReady(selectedModel) || isLoading || isPlanning || isAdvancing) {
      return;
    }
    if (revisionStage) {
      const reply = content.text.trim();
      void reviseProduction(revisionStage, reply);
      editorRef.current?.clear();
      setText("");
      setRevisionStage(null);
      setActionError("");
      return;
    }
    const productionMode = content.tokens.find((token) => token.id.startsWith(CREATION_MODE_TOKEN_PREFIX));
    const productionCommand = content.text.match(/^\s*\/\s*(剧情短片|全流程广告片导演|剧本开发)\s*/);
    if (productionMode || productionCommand) {
      const idea = productionMode ? content.text.trim() : content.text.slice(productionCommand![0].length).trim();
      if (!idea) {
        setActionError("请在导演模式后输入故事创意");
        return;
      }
      const styleToken = content.tokens.find((token) => token.id.startsWith(VIDEO_STYLE_TOKEN_PREFIX));
      const style = VIDEO_STYLES.find((item) => item.id === styleToken?.id.slice(VIDEO_STYLE_TOKEN_PREFIX.length));
      void planProduction(idea, selectedModel.id, getVideoStylePrompt(style));
      setPendingProductionIdea(idea);
      setPendingProductionTokens(content.tokens.filter((token) =>
        token.id.startsWith(CREATION_MODE_TOKEN_PREFIX) || token.id.startsWith(VIDEO_STYLE_TOKEN_PREFIX),
      ));
      setProductionIdeaInCard(messages.length > 0);
      editorRef.current?.clear();
      setText("");
      setActionError("");
      return;
    }
    void send({
      text: content.text,
      modelId: selectedModel.id,
      files: attachments.map((file) => ({
        name: file.name,
        type: file.type,
        url: file.url,
        content: file.url.includes(";base64,")
          ? file.url.split(";base64,")[1]
          : file.url,
      })),
      skillIds: selectedSkillIds,
      subjects: selectedSubjects,
      mode,
    });
    editorRef.current?.clear();
    setText("");
    setAttachments([]);
    setSelectedSubjects([]);
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const totalSize =
      attachments.reduce((total, file) => total + file.file.size, 0) +
      incoming.reduce((total, file) => total + file.size, 0);
    const supported = incoming.every(
      (file) =>
        file.type.startsWith("image/") ||
        file.type.startsWith("text/") ||
        ["application/json", "application/pdf"].includes(file.type),
    );
    if (attachments.length + incoming.length > 5 || totalSize > 5 * 1024 * 1024) {
      setActionError("最多上传 5 个附件，总大小不能超过 5MB");
      return;
    }
    if (!supported) {
      setActionError("仅支持图片、文本、JSON 和 PDF 文件");
      return;
    }
    const loaded = await Promise.all(
      incoming.map(
        (file) =>
          new Promise<PendingAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                type: file.type,
                url: reader.result as string,
                file,
                tokenId: `attachment-${crypto.randomUUID()}`,
              });
            reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
            reader.readAsDataURL(file);
          }),
      ),
    );
    setAttachments((current) => [...current, ...loaded]);
    loaded.forEach((file) => editorRef.current?.insertToken({
      id: file.tokenId,
      kind: "attachment",
      label: file.name,
      url: file.url,
      mimeType: file.type,
    }));
    setActionError("");
  };

  const handleTokenRemove = (token: EditorToken) => {
    if (token.id.startsWith(VIDEO_STYLE_TOKEN_PREFIX)) {
      setSelectedVideoStyle((current) => current === token.id.slice(VIDEO_STYLE_TOKEN_PREFIX.length) ? "" : current);
    } else if (token.kind === "skill") {
      setSelectedSkillIds((current) => current.filter((id) => id !== token.id));
    } else if (token.kind === "subject") {
      setSelectedSubjects((current) => current.filter((subject) => subject.id !== token.id));
    } else {
      setAttachments((current) => current.filter((file) => file.tokenId !== token.id));
    }
  };

  const openReferenceMenu = () => {
    const caret = editorRef.current?.getCaretRect();
    if (!caret) return;
    setReferenceMenuPosition({
      left: Math.min(window.innerWidth - 272, Math.max(16, caret.left - 128)),
      top: caret.top,
    });
  };

  const selectReference = (reference: SubjectReference) => {
    if (!selectedSubjects.some((item) => item.id === reference.id)) {
      setSelectedSubjects((current) => [...current, reference]);
      editorRef.current?.insertToken({ id: reference.id, kind: "subject", label: reference.name, url: reference.url, referenceKind: reference.kind });
    }
  };

  const handleEditorTextChange = (value: string) => {
    setText(value);
    if (!referenceMenuPosition) return;
    const triggerIndex = value.lastIndexOf("@");
    if (triggerIndex < 0 || /\s/.test(value.slice(triggerIndex + 1))) {
      setReferenceMenuPosition(null);
    }
  };

  const handleNewSession = async () => {
    try {
      await createSession();
      resetProduction();
      setSelectedVideoStyle("");
      setPendingProductionIdea("");
      setPendingProductionTokens([]);
      setProductionIdeaInCard(false);
      setRevisionStage(null);
      setActionError("");
      setSessionMenuOpen(false);
    } catch (cause) {
      setActionError((cause as Error).message);
    }
  };

  const handleRename = async (id: string, title: string) => {
    const nextTitle = window.prompt("重命名会话", title)?.trim();
    if (!nextTitle) return;
    try {
      await renameSession(id, nextTitle);
      setActionError("");
    } catch (cause) {
      setActionError((cause as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除这个会话吗？")) return;
    try {
      await deleteSession(id);
      setActionError("");
    } catch (cause) {
      setActionError((cause as Error).message);
    }
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = resizeRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const maxWidth = Math.min(810, window.innerWidth - 32);
    const minWidth = Math.min(600, maxWidth);
    const nextWidth = start.startWidth + start.startX - event.clientX;
    onWidthChange(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
  };

  const stopResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const maxWidth = Math.min(810, window.innerWidth - 32);
    const minWidth = Math.min(600, maxWidth);
    const delta = event.key === "ArrowLeft" ? 16 : -16;
    onWidthChange(Math.min(maxWidth, Math.max(minWidth, width + delta)));
  };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={currentTitle}
      style={{ width, maxWidth: "calc(100% - 2rem)" }}
      className="nodrag nopan absolute right-4 bottom-4 z-30 flex h-[calc(100%-2rem)] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#171717] text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
    >
      <div
        role="separator"
        aria-label="调整会话面板宽度"
        aria-orientation="vertical"
        aria-valuemin={600}
        aria-valuemax={810}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={stopResize}
        onPointerCancel={stopResize}
        onKeyDown={resizeWithKeyboard}
        className="absolute inset-y-0 left-0 z-40 w-2 cursor-ew-resize touch-none border-l border-transparent outline-none transition-colors hover:border-white/50 focus-visible:border-white/60"
      />
      <header className="flex items-center justify-between px-5 py-4">
        <div ref={sessionMenuRef} className="relative min-w-0">
          <button
            type="button"
            onClick={() => setSessionMenuOpen((open) => !open)}
            className="flex max-w-56 cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-white/5"
          >
            <h2 className="truncate text-base font-medium">{currentTitle}</h2>
            <ChevronDown size={13} className="shrink-0 text-white/50" />
          </button>
          {sessionMenuOpen && (
            <div className="absolute top-full left-0 z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-white/10 bg-[#242424] p-1.5 shadow-2xl">
              {sessions.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-white/40">
                  暂无历史会话
                </div>
              )}
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center rounded-lg ${
                    session.id === currentSessionId ? "bg-white/8" : "hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      void selectSession(session.id);
                      setSessionMenuOpen(false);
                    }}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm"
                  >
                    <span className="truncate">{session.title}</span>
                    {session.id === currentSessionId && (
                      <Check size={14} className="ml-auto shrink-0" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`重命名 ${session.title}`}
                    onClick={() => void handleRename(session.id, session.title)}
                    className="cursor-pointer p-1.5 text-white/40 hover:text-white"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除 ${session.title}`}
                    disabled={isLoading && session.id === currentSessionId}
                    onClick={() => void handleDelete(session.id)}
                    className="mr-1 cursor-pointer p-1.5 text-white/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label="新建会话"
            onClick={() => void handleNewSession()}
          >
            <MessageSquarePlus size={17} />
          </IconButton>
          <IconButton
            label="关闭"
            onClick={onClose}
          >
            <Minimize2 size={16} />
          </IconButton>
        </div>
      </header>

      {messages.length === 0 && !production && !isPlanning ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 pb-12">
          <h3 className="text-center text-2xl leading-tight font-normal text-white/95 sm:text-[28px]">
            探索更多专业创作模式
          </h3>
          <div className="mt-6 flex max-w-[500px] flex-wrap items-center justify-center gap-2">
            {CREATION_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => selectMode(mode)}
                className="cursor-pointer rounded-full border border-white/8 bg-white/[0.045] px-4 py-2 text-sm text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={messagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          {!productionIdeaInCard && (production?.idea || pendingProductionIdea) && (
            <div className="flex justify-end">
              <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-white/10 px-3.5 py-2.5 text-sm leading-6 text-white/90">
                <ProductionSelectionTags tokens={pendingProductionTokens} />
                {production?.idea || pendingProductionIdea}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                  message.role === "user"
                    ? "whitespace-pre-wrap bg-white/10 text-white/90"
                    : "bg-white/5 text-white/85"
                }`}
              >
                {message.subjects && message.subjects.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {message.subjects.map((subject) => (
                      <span key={subject.id} className="rounded-md bg-white/8 px-1.5 py-0.5 text-xs text-white/55">
                        @{subject.name}
                      </span>
                    ))}
                  </div>
                )}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {message.attachments.map((attachment, attachmentIndex) =>
                      attachment.type.startsWith("image/") ? (
                        <img
                          key={`${attachment.name}-${attachmentIndex}`}
                          src={fileUrl(attachment.url)}
                          alt={attachment.name}
                          className="max-h-40 max-w-48 rounded-lg object-cover"
                        />
                      ) : (
                        <a
                          key={`${attachment.name}-${attachmentIndex}`}
                          href={fileUrl(attachment.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-white/8 px-2 py-1.5 text-xs text-white/70"
                        >
                          <FileText size={13} />
                          {attachment.name}
                        </a>
                      ),
                    )}
                  </div>
                )}
                {message.role === "user" ? (
                  message.content
                ) : message.content ? (
                  <Markdown
                    className="agent-markdown"
                    animating={isLoading && index === messages.length - 1}
                  >
                    {message.content}
                  </Markdown>
                ) : (
                  <span className="thinking-shimmer">认真思考中...</span>
                )}
                {message.toolCalls?.map((tool) => (
                  <div key={tool.id} className="mt-2 text-xs text-white/40">
                    {tool.status === "running" ? "正在调用" : "已调用"}：{tool.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {isPlanning && (
            <div className="rounded-2xl border border-white/8 bg-[#1d1d1f] px-4 py-4 text-sm text-white/65">
              {productionIdeaInCard && pendingProductionIdea && <div className="mb-3 flex justify-end"><div className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-white/10 px-3.5 py-2.5 text-white/90"><ProductionSelectionTags tokens={pendingProductionTokens} />{pendingProductionIdea}</div></div>}
              <div className="mb-3">导演 Agent 正在分析创作需求…</div>
              <ProductionStreamingPreview preview={streamPreview} />
            </div>
          )}
          {production && !isPlanning && (
            <ProductionTimeline
              project={production}
              initialResponse={productionIdeaInCard ? <><ProductionSelectionTags tokens={pendingProductionTokens} />{production.idea}</> : ""}
              advancing={isAdvancing}
              streamPreview={streamPreview}
              onConfirmStage={(mode, continuity) => void confirmStage(mode, continuity)}
              onConfirm={() => void confirmProduction()}
              onStartPhase={(phase) => void startMediaPhase(phase)}
              onPause={() => void pauseProduction()}
              onRetry={(nodeId, independent) => void retryProduction(nodeId, independent)}
              onAutoCompleteRequirements={() => {
                void reviseProduction(
                  "requirements",
                  "我授权你根据已知需求自动补充所有缺失设定。请直接做出合理、连贯、适合制作的创作选择，不再向我提问，并输出完整需求摘要供我确认。",
                );
              }}
              onModify={(stage) => {
                setRevisionStage(stage);
                editorRef.current?.clear();
                setText("");
                editorRef.current?.insertText("");
              }}
            />
          )}
        </div>
      )}

      {(error || actionError || productionError) && (
        <div className="mx-5 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error || actionError || productionError}
        </div>
      )}

      <div className="p-3">
        <div className="rounded-[22px] border border-white/10 bg-[#101010] p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
          <div className="relative max-h-40 min-h-[60px] cursor-text overflow-y-auto leading-6" onClick={(event) => {
            if (event.target === event.currentTarget) {
              editorRef.current?.focusEnd();
            }
          }}>
            <Editor
              ref={editorRef}
              onSubmit={handleSend}
              images={[]}
              initialState=""
              noImageMention
              autoFocus={false}
              onTextChange={handleEditorTextChange}
              onTrigger={(trigger) => {
                if (trigger === "/") setSkillMenuOpen(true);
                else window.setTimeout(openReferenceMenu, 0);
              }}
              onTokenRemove={handleTokenRemove}
              onBlur={() => setReferenceMenuPosition(null)}
              placeholder={revisionStage ? `请输入对${revisionLabel}的修改或补充` : "输入想法、剧本或上传参考，支持“/”选择创作模式，@ 添加主体"}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-white/75 sm:gap-1">
            <button
              type="button"
              aria-label="添加附件"
              title="添加附件"
              onClick={() => fileInputRef.current?.click()}
              className="flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-white/8 hover:text-white"
            >
              <Plus size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,text/*,.json,.pdf"
              className="hidden"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => setMode((current) => current === "agent" ? "chat" : "agent")}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-xs transition-colors hover:bg-white/8 hover:text-white"
            >
              <SlidersHorizontal size={16} />
              {mode === "agent" ? "智能" : "普通"}
            </button>
            <div ref={skillMenuRef} className="relative">
              <button type="button" onClick={() => setSkillMenuOpen((open) => !open)} className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-xs transition-colors hover:bg-white/8 hover:text-white">
                <Shuffle size={16} />
                创作模式
              </button>
              {skillMenuOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-white/10 bg-[#242424] p-1.5 shadow-2xl">
                  {CREATION_MODES.map((creationMode) => (
                    <button key={creationMode} type="button" onClick={() => selectMode(creationMode)} className="flex w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/8">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-white/85">{creationMode}</span>
                        <span className="mt-0.5 block text-[11px] text-white/40">{CREATION_MODE_DESCRIPTIONS[creationMode]}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={isPlanning || isAdvancing || Boolean(production && !["requirements_clarifying", "requirements_review"].includes(production.status))}
              onClick={() => setVideoStyleOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-1 text-xs transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Palette size={16} />
              视频风格
            </button>
            <div className="relative">
              <button type="button" aria-label="引用参考" title="引用参考" onClick={() => {
                editorRef.current?.insertText("@");
                window.setTimeout(openReferenceMenu, 0);
              }} className="flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-white/8 hover:text-white">
                @
              </button>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <OptionPopper
                label={selectedModel?.name ?? "选择模型"}
                labelClassName="block max-w-40 truncate"
                options={textModels.map((model) => model.name)}
                value={selectedModel?.name}
                onChange={(name) => {
                  const model = textModels.find((item) => item.name === name);
                  if (model) setSelectedModelId(model.id);
                }}
              />
              {isLoading || isPlanning || isAdvancing ? (
                <button
                  type="button"
                  aria-label="停止生成"
                  onClick={isPlanning || isAdvancing ? stopProduction : stop}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/80 text-[#171717] hover:bg-white"
                >
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="发送消息"
                  onClick={handleSend}
                  disabled={!text.trim() || !selectedModel || !isModelReady(selectedModel)}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/85 text-[#171717] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/45"
                >
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {referenceMenuPosition && (
        <ReferencePicker
          references={subjects}
          position={referenceMenuPosition}
          query={referenceMenuPosition ? text.slice(text.lastIndexOf("@") + 1) : ""}
          onSelect={selectReference}
          onClose={() => setReferenceMenuPosition(null)}
        />
      )}
      <VideoStylePicker
        open={videoStyleOpen}
        value={selectedVideoStyle}
        onClose={() => setVideoStyleOpen(false)}
        onConfirm={(value) => {
          const tokens = editorRef.current?.getContent()?.tokens ?? [];
          tokens.forEach((token) => {
            if (token.id.startsWith(VIDEO_STYLE_TOKEN_PREFIX)) {
              editorRef.current?.removeToken(token.id);
            }
          });
          const style = VIDEO_STYLES.find((item) => item.id === value);
          if (style) {
            editorRef.current?.insertToken({
              id: `${VIDEO_STYLE_TOKEN_PREFIX}${style.id}`,
              kind: "style",
              label: style.name,
            });
          }
          setSelectedVideoStyle(value);
          setVideoStyleOpen(false);
          if (production && ["requirements_clarifying", "requirements_review"].includes(production.status)) {
            void reviseProduction("requirements", style
              ? `用户将全片视频风格明确修改为：${style.name}。风格要求：${getVideoStylePrompt(style)}。请更新需求摘要，后续所有阶段统一继承。`
              : "用户取消指定视频风格，请根据故事内容由 Agent 推荐合适的全片视觉风格，并更新需求摘要。");
          }
        }}
      />
    </section>
  );
}
