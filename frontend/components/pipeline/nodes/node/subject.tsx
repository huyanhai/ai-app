"use client";
import { memo, useRef, useState } from "react";
import { NodeProps, useReactFlow } from "@xyflow/react";
import {
  AudioLines,
  ImagePlus,
  Import,
  Library,
  Loader2,
  MoreHorizontal,
  Music,
  ScanFace,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import NodeShell from "./shell";
import {
  TNodeSubject,
  TNodeSubjectData,
  NodeType,
  TAllNodes,
} from "../../types";
import { usePipelineStore } from "@/store/pipeline-store";
import { canvasHistoryApi } from "@/lib/canvas-history";
import { useClickOutSide } from "@/hooks/use-click-outside";
import { useCanvasId } from "../../canvas-workspace-context";
import { sseFetch } from "@/lib/sse";
import { getAudioModel, isModelReady, useModelStore } from "@/store/model-store";
import { ChunkStatus, IMediaData } from "backend/src/common/utils/ai-stream-utils";

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("无法读取所选文件"));
    reader.readAsDataURL(file);
  });

const SubjectNode = ({ id, data, selected }: NodeProps<TNodeSubject>) => {
  const { setNodes } = useReactFlow<TAllNodes>();
  const canvasId = useCanvasId();
  const openSubjectAssets = usePipelineStore(
    (state) => state.openSubjectAssets,
  );
  const [editingDesc, setEditingDesc] = useState(false);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [voiceActionsOpen, setVoiceActionsOpen] = useState(false);
  const [voiceGenerating, setVoiceGenerating] = useState(false);
  const [uploading, setUploading] = useState<"main" | "voice" | null>(null);
  const [error, setError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const voiceMenuRef = useRef<HTMLDivElement>(null);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const closeVoiceMenu = () => {
    setVoiceMenuOpen(false);
    setVoiceActionsOpen(false);
  };
  useClickOutSide([voiceMenuRef], closeVoiceMenu, voiceMenuOpen);

  const updateData = (patch: Partial<TNodeSubjectData>) => {
    setNodes(
      (nodes) =>
        nodes.map((node) =>
          node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
        ) as TAllNodes[],
    );
  };

  const saveDescription = (value: string) => {
    updateData({ description: value });
    setEditingDesc(false);
  };

  const uploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading("main");
    setError("");
    try {
      updateData({
        url: await canvasHistoryApi.uploadAsset(await readFile(file)),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "图片上传失败");
    } finally {
      setUploading(null);
    }
  };

  const uploadVoice = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading("voice");
    setError("");
    try {
      updateData({
        voiceUrl: await canvasHistoryApi.uploadAsset(await readFile(file)),
      });
      closeVoiceMenu();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "音色上传失败");
    } finally {
      setUploading(null);
    }
  };

  const chooseVoice = (source: "canvas" | "assets") => {
    openSubjectAssets({ nodeId: id, slot: "voice", source });
    closeVoiceMenu();
  };

  const removeVoice = () => {
    voiceAbortRef.current?.abort();
    updateData({ voiceUrl: undefined });
    setError("");
    closeVoiceMenu();
  };

  const generateVoice = async () => {
    const prompt = data.description?.trim() || data.name.trim() || (data.url ? "" : "你好");
    closeVoiceMenu();
    try {
      await useModelStore.getState().loadModels();
    } catch {
      setError("模型配置加载失败，请稍后重试");
      return;
    }
    const model = getAudioModel(data.config?.model);
    if (!model || !isModelReady(model)) {
      setError("未配置可用的音频模型，请先在模型配置中完善");
      return;
    }

    voiceAbortRef.current?.abort();
    const abortController = new AbortController();
    voiceAbortRef.current = abortController;
    setVoiceGenerating(true);
    setError("");
    let generationRecorded = false;
    try {
      await sseFetch({
        url: "/pipeline/dubbing",
        body: JSON.stringify({
          message: [
            ...(data.url ? [{ type: "image_url", image_url: data.url }] : []),
            ...(prompt ? [{ type: "text", text: prompt }] : []),
          ],
          modelId: model.id,
        }),
        abortController,
        cb: (event) => {
          if (abortController.signal.aborted) return;
          if (event.type === "msg_chunk" && typeof event.content === "object" && "status" in event.content) {
            const { url, status } = event.content as IMediaData;
            if (status !== ChunkStatus.SUCCESS || !url) return;
            updateData({ voiceUrl: url });
            if (!generationRecorded) {
              generationRecorded = true;
              void canvasHistoryApi.recordGeneration(canvasId, {
                nodeId: id,
                nodeType: NodeType.AudioNode,
                title: `${data.name} · 智能配音`,
                model: model.name,
                url,
              }).catch(() => undefined);
            }
          }
          if (event.type === "msg_error") setError(event.error);
        },
      });
    } catch (reason) {
      if (!abortController.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "智能配音失败");
      }
    } finally {
      if (voiceAbortRef.current === abortController) {
        voiceAbortRef.current = null;
        setVoiceGenerating(false);
      }
    }
  };

  const voiceLoading = uploading === "voice" || voiceGenerating;

  return (
    <NodeShell
      id={id}
      type={NodeType.SubjectNode}
      selected={selected}
      title={data.name}
      icon={<ScanFace size={12} />}
      overflowVisible
    >
      <div className="w-[300px] rounded-2xl border border-white/5 bg-[#1f1f22] p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <input
              aria-label="主体名称"
              value={data.name}
              onChange={(event) =>
                updateData({
                  name: event.target.value,
                  title: event.target.value,
                })
              }
              className="nodrag w-full bg-transparent text-sm font-medium text-white/90 outline-none"
            />
            {editingDesc ? (
              <textarea
                autoFocus
                defaultValue={data.description}
                placeholder="添加描述..."
                onBlur={(event) => saveDescription(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    saveDescription(event.currentTarget.value);
                  }
                }}
                className="nodrag nowheel mt-1 w-full resize-none rounded-lg bg-white/5 p-2 text-xs text-white/80 outline-none"
                rows={2}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingDesc(true)}
                className="nodrag mt-1 text-left text-xs text-white/40 transition-colors hover:text-white/60 cursor-pointer"
              >
                {data.description || "添加描述..."}
              </button>
            )}
          </div>
          <div ref={voiceMenuRef} className="nodrag group/voice relative shrink-0">
            <button
              type="button"
              aria-label={voiceGenerating ? "正在生成音色" : data.voiceUrl ? "音色" : "添加音色"}
              aria-expanded={voiceMenuOpen}
              disabled={voiceLoading}
              onClick={() => {
                if (voiceMenuOpen) {
                  closeVoiceMenu();
                } else {
                  setVoiceActionsOpen(!data.voiceUrl);
                  setVoiceMenuOpen(true);
                }
              }}
              className="relative grid size-6 place-items-center rounded-md bg-white/5 text-white/65 hover:bg-white/10 hover:text-white disabled:opacity-60 cursor-pointer"
            >
              {voiceLoading ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <AudioLines size={17} />
              )}
            </button>
            {data.voiceUrl && !voiceLoading && (
              <>
                <button
                  type="button"
                  aria-label="移除音色"
                  onClick={removeVoice}
                  className="absolute -right-1 -top-1 z-10 grid size-3 place-items-center rounded-full bg-white/20 text-white opacity-0 transition-opacity hover:bg-white/35 group-hover/voice:opacity-100 cursor-pointer"
                >
                  <X size={9} />
                </button>
                {!voiceMenuOpen && (
                  <span className="pointer-events-none absolute left-full top-0 z-40 ml-2 whitespace-nowrap rounded-lg bg-[#29292c] px-3 py-2 text-xs text-white/85 opacity-0 shadow-xl transition-opacity group-hover/voice:opacity-100">
                    智能配音
                  </span>
                )}
              </>
            )}
            {voiceMenuOpen && (
              <div
                role="dialog"
                aria-label="音色设置"
                className="absolute left-full top-0 z-50 ml-2 w-60 rounded-2xl border border-white/10 bg-[#29292c] p-2 shadow-2xl"
              >
                {data.voiceUrl && (
                  <div className="rounded-xl bg-black/20 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-white/85">音色</span>
                      <button
                        type="button"
                        aria-label="更多音色操作"
                        aria-expanded={voiceActionsOpen}
                        onClick={() => setVoiceActionsOpen((open) => !open)}
                        className="grid size-6 place-items-center rounded-md text-white/55 hover:bg-white/10 hover:text-white cursor-pointer"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                    <audio
                      controls
                      autoPlay
                      preload="metadata"
                      src={data.voiceUrl}
                      className="nowheel h-9 w-full"
                    />
                  </div>
                )}
                {voiceActionsOpen && (
                  <div className={data.voiceUrl ? "absolute left-full top-0 ml-2 w-60 rounded-2xl border border-white/10 bg-[#29292c] p-2 shadow-2xl" : ""}>
                    {data.voiceUrl && (
                      <div className="px-2 pb-1 pt-1 text-xs text-white/40">替换音色</div>
                    )}
                    <button
                      type="button"
                      onClick={() => chooseVoice("canvas")}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white cursor-pointer"
                    >
                      <ImagePlus size={16} />
                      从画布选择
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseVoice("assets")}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white cursor-pointer"
                    >
                      <Library size={16} />
                      从资产库选择
                    </button>
                    <button
                      type="button"
                      disabled={uploading !== null}
                      onClick={() => voiceInputRef.current?.click()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white disabled:opacity-40 cursor-pointer"
                    >
                      <Upload size={16} />
                      本地添加
                    </button>
                    <button
                      type="button"
                      onClick={generateVoice}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white cursor-pointer"
                    >
                      <Music size={16} />
                      智能配音
                    </button>
                    {data.voiceUrl && (
                      <button
                        type="button"
                        onClick={removeVoice}
                        className="mt-1 flex w-full items-center gap-3 border-t border-white/5 px-3 py-2.5 pt-3 text-left text-sm text-white/75 hover:bg-white/5 hover:text-white cursor-pointer"
                      >
                        <Trash2 size={16} />
                        删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {data.url && (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/5 bg-black/20">
            <div className="group/image relative">
              <img
                src={data.url}
                alt={`${data.name}主素材`}
                className="aspect-video w-full object-cover"
              />
              <button
                type="button"
                aria-label="移除主素材"
                onClick={() => updateData({ url: undefined })}
                className="nodrag pointer-events-none absolute right-2 top-2 grid size-5 cursor-pointer place-items-center rounded-full bg-black/60 text-white/70 opacity-0 transition-opacity hover:bg-black/80 hover:text-white focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/image:pointer-events-auto group-hover/image:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {!data.url && <div className="nodrag mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              openSubjectAssets({
                nodeId: id,
                slot: "import",
                source: "subjects",
              })
            }
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <Import size={13} />
            导入主体
          </button>
          <button
            type="button"
            onClick={() =>
              openSubjectAssets({ nodeId: id, slot: "main", source: "canvas" })
            }
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <ImagePlus size={13} />
            从画布选择
          </button>
          <button
            type="button"
            onClick={() =>
              openSubjectAssets({
                nodeId: id,
                slot: "main",
                source: "subjects",
              })
            }
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <Library size={13} />
            从资产库选择
          </button>
          <button
            type="button"
            disabled={uploading !== null}
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40 cursor-pointer"
          >
            {uploading === "main" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Upload size={13} />
            )}
            本地添加
          </button>
        </div>}
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={uploadImage}
        />
        <input
          ref={voiceInputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg,audio/webm"
          className="hidden"
          onChange={uploadVoice}
        />
      </div>
    </NodeShell>
  );
};

export default memo(SubjectNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
