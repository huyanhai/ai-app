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

const CREATION_MODES = [
  "视频反解",
  "创作分镜",
  "全流程广告片导演",
  "剧本开发",
  "剧情短片",
];

interface AIChatPanelProps {
  onClose: () => void;
  subjects: SubjectReference[];
  width: number;
  onWidthChange: (width: number) => void;
}

type PendingAttachment = AttachmentFile & { tokenId: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const fileUrl = (url: string) =>
  url.startsWith("/") ? `${API_BASE}${url}` : url;

export default function AIChatPanel({ onClose, subjects, width, onWidthChange }: AIChatPanelProps) {
  const [text, setText] = useState("");
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [actionError, setActionError] = useState("");
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
    skills,
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
  const textModels = models.filter(
    (model) => model.category === ModelCategory.Text && model.enabled,
  );
  const selectedModel = textModels.find((model) => model.id === selectedModelId);
  const currentTitle =
    sessions.find((session) => session.id === currentSessionId)?.title ??
    "新会话";

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
  }, [messages]);

  useClickOutSide(sessionMenuRef, () => setSessionMenuOpen(false), sessionMenuOpen);
  useClickOutSide(skillMenuRef, () => setSkillMenuOpen(false), skillMenuOpen);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const selectMode = (mode: string) => {
    editorRef.current?.insertText(`/ ${mode}`);
  };

  const handleSend = () => {
    const content = editorRef.current?.getContent();
    if (!content?.text || !selectedModel || !isModelReady(selectedModel) || isLoading) {
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
    if (token.kind === "skill") {
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
    const minWidth = Math.min(400, maxWidth);
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
    const minWidth = Math.min(400, maxWidth);
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
        aria-valuemin={400}
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

      {messages.length === 0 ? (
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
                <span className="mr-2 text-white/65">/</span>
                {mode}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={messagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                  message.role === "user"
                    ? "whitespace-pre-wrap bg-white/10 text-white/90"
                    : "w-full text-white/85"
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
        </div>
      )}

      {(error || actionError) && (
        <div className="mx-5 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error || actionError}
        </div>
      )}

      <div className="p-3">
        <div className="rounded-[22px] border border-white/10 bg-[#101010] p-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]">
          <div className="relative max-h-40 min-h-[60px] cursor-text overflow-y-auto leading-6" onClick={(event) => {
            if (event.target === event.currentTarget) {
              event.currentTarget.querySelector<HTMLElement>("[contenteditable]")?.focus();
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
              placeholder="输入想法、剧本或上传参考，支持“/”使用技能，@ 添加主体，和 Agent 一起创作"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-white/75 sm:gap-1">
            <button
              type="button"
              aria-label="添加附件"
              title="添加附件"
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-md p-1 transition-colors hover:bg-white/8 hover:text-white"
            >
              <Plus size={21} />
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
                使用技能
              </button>
              {skillMenuOpen && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-white/10 bg-[#242424] p-1.5 shadow-2xl">
                  {skills.length === 0 && <div className="px-3 py-4 text-center text-xs text-white/40">暂无可用技能</div>}
                  {skills.map((skill) => {
                    const selected = selectedSkillIds.includes(skill.id);
                    return (
                      <button key={skill.id} type="button" onClick={() => {
                        if (selected) {
                          editorRef.current?.removeToken(skill.id);
                        } else {
                          setSelectedSkillIds((current) => [...current, skill.id]);
                          editorRef.current?.insertToken({ id: skill.id, kind: "skill", label: skill.name });
                        }
                        setSkillMenuOpen(false);
                      }} className="flex w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/8">
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-white/85">{skill.name}</span>
                          <span className="mt-0.5 line-clamp-2 block text-[11px] text-white/40">{skill.description}</span>
                        </span>
                        {selected && <Check size={13} className="mt-0.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="relative">
              <button type="button" aria-label="引用参考" title="引用参考" onClick={() => {
                editorRef.current?.insertText("@");
                window.setTimeout(openReferenceMenu, 0);
              }} className="cursor-pointer rounded-md p-1 transition-colors hover:bg-white/8 hover:text-white">
                @
              </button>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <OptionPopper
                label={selectedModel?.name ?? "选择模型"}
                options={textModels.map((model) => model.name)}
                value={selectedModel?.name}
                onChange={(name) => {
                  const model = textModels.find((item) => item.name === name);
                  if (model) setSelectedModelId(model.id);
                }}
              />
              {isLoading ? (
                <button
                  type="button"
                  aria-label="停止生成"
                  onClick={stop}
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
    </section>
  );
}
