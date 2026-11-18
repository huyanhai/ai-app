"use client";
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactFlow, useStore } from "@xyflow/react";
import {
  ArrowUp,
  AtSign,
  Camera,
  ChevronDown,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  Palette,
  Play,
  Sparkles,
  Shapes,
  Square,
  Video,
  Plus,
  X,
} from "lucide-react";
import { nanoid } from "nanoid";
import superjson from "superjson";
import Editor from "../../editor";
import OptionPopper from "../../option-popper";
import SizeConfig from "../../chat-input/config/size-config";
import VideoConfig from "../../chat-input/config/video-config";
import Frame from "../../chat-input/frame";
import { useGenerate } from "../../hooks/use-generate";
import {
  NODE_PROMPT_PLACEHOLDER,
  SOURCE_RIGHT_ANCHOR,
  TARGET_LEFT_ANCHOR,
  TEXT_SCENES,
} from "../../constants";
import CameraModal from "../../toolbox/camera-modal";
import MovementModal from "../../toolbox/movement-modal";
import PaletteModal from "../../toolbox/palette-modal";
import StyleModal from "../../toolbox/style-modal";
import { TCameraSelection } from "../../toolbox/data";
import {
  NodeType,
  TAllNodes,
  TNodeBase,
  TNodeImage,
  TNodeSubject,
  TPaletteSelection,
  VideoModeType,
} from "../../types";
import { ModelCategory, TModelConfigOf } from "@/components/models/types";
import { useModelStore } from "@/store/model-store";
import { usePipelineStore } from "@/store/pipeline-store";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import ReferencePicker from "../../reference-picker";
import type { EditorToken } from "../../editor/nodes";
import MarkerEditor from "./image/marker-editor";
import OutpaintEditor from "./image/outpaint-editor";
import UpscaleEditor from "./image/upscale-editor";
import { getImagePreset } from "./image/presets";
import type {
  ReferenceKind,
  SubjectReference,
} from "@/components/chat/types";

// 可在此表单中生成的节点类型
export const GENERATOR_TYPES: NodeType[] = [
  NodeType.TextNode,
  NodeType.ImageNode,
  NodeType.VideoNode,
  NodeType.AudioNode,
];

type TToolboxId = "camera" | "movement" | "palette" | "style";

type PromptReference = TNodeImage | TNodeSubject;

const cleanReferenceLabel = (value: string) => value
  .replace(/^(?:场景参考图|道具图|角色图)\s*[｜|·:：-]\s*/, "")
  .replace(/\s*(?:·\s*)?(?:角色|道具)?三视图.*$/, "")
  .replace(/\s*(?:·\s*)?场景参考图.*$/, "")
  .trim();

const promptReferenceLabel = (reference: PromptReference) => {
  const data = reference.data;
  const title = cleanReferenceLabel(data.title || "");
  if (reference.type === NodeType.SubjectNode && "name" in data) {
    const name = cleanReferenceLabel(data.name || "");
    if (name && !/^主体\s*\d+$/.test(name)) return name;
  }
  return title || reference.id;
};

const promptReferenceAliases = (reference: PromptReference) => {
  const values = new Set<string>();
  const add = (value?: string) => {
    const cleaned = cleanReferenceLabel(value || "");
    if (!cleaned || /^主体\s*\d+$/.test(cleaned)) return;
    values.add(cleaned);
    const base = cleaned.replace(/[（(].*$/, "").trim();
    if (base) values.add(base);
    for (const match of cleaned.matchAll(/[（(]([^）)]+)[）)]/g)) {
      for (const part of match[1].split(/[·•|｜]/)) {
        const alias = part.replace(/[·\s]*v\d+$/i, "").trim();
        if (alias) values.add(alias);
      }
    }
  };
  add(reference.data.title);
  if ("name" in reference.data) add(reference.data.name);
  add(promptReferenceLabel(reference));
  return [...values].sort((left, right) => right.length - left.length);
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const areReferencesEqual = (previous: SubjectReference[], current: SubjectReference[]) =>
  previous.length === current.length &&
  previous.every((reference, index) => {
    const next = current[index];
    return reference.id === next.id &&
      reference.kind === next.kind &&
      reference.name === next.name &&
      reference.description === next.description &&
      reference.url === next.url;
  });

// 即梦风格顶部导演工具 pill（相机 / 配色 / 风格 / 运镜），嵌在卡片顶部整行铺满
const ToolPills = ({
  type,
  onCollapse,
  onOpen,
}: {
  type: NodeType;
  onCollapse: () => void;
  onOpen: (id: TToolboxId) => void;
}) => {
  const pills =
    type === NodeType.ImageNode
      ? [
          { id: "camera" as const, icon: <Camera size={14} />, label: "相机" },
          { id: "palette" as const, icon: <Palette size={14} />, label: "配色" },
          { id: "style" as const, icon: <Shapes size={14} />, label: "风格" },
        ]
      : [
          { id: "palette" as const, icon: <Palette size={14} />, label: "配色" },
          { id: "style" as const, icon: <Shapes size={14} />, label: "风格" },
          { id: "movement" as const, icon: <Video size={14} />, label: "运镜" },
        ];

  return (
    <div className="mb-2 flex items-center gap-2">
      {pills.map((pill) => (
        <button
          key={pill.label}
          onClick={() => pill.id && onOpen(pill.id)}
          className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/5 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {pill.icon}
          {pill.label}
        </button>
      ))}
      <button
        aria-label="收起工具"
        onClick={onCollapse}
        className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
};

// 即梦风格生成表单：跟随选中节点浮在其下方（+ 参考 / 提示词 / 底部配置条 / 发送按钮）
const GeneratorCard = ({ node, active }: { node: TAllNodes; active: boolean }) => {
  const id = node.id;
  const type = node.type as NodeType;
  const data = node.data;
  const imagePreset = type === NodeType.ImageNode
    ? getImagePreset((data as TNodeImage["data"]).preset)
    : undefined;
  const ImagePresetIcon = imagePreset?.icon;

  const { setNodes, setEdges, getNode } = useReactFlow<TAllNodes>();
  const fileRef = useRef<HTMLInputElement>(null);
  const legacyPrompt = "text" in data ? data.text : "";
  const initialPrompt = data.draftText || data.production?.prompt || legacyPrompt || "";
  const [pillsCollapsed, setPillsCollapsed] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState<TToolboxId | null>(null);
  const [editorText, setEditorText] = useState(initialPrompt);
  const [referenceQuery, setReferenceQuery] = useState("");
  const [referenceMenuPosition, setReferenceMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const models = useModelStore((s) => s.models);
  const defaults = useModelStore((s) => s.defaults);
  const { editorRef, submit, stop, disabled, setIsEmpty, imageNodes, videoNodes, subjectNodes, optimizePrompt, isOptimizing, optimizationError } = useGenerate(
    id,
    type,
    data,
  );
  const [previewReference, setPreviewReference] = useState<{
    kind: "image" | "video";
    title: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (editorRef.current?.getContent().tokens.length) return;
    const references = [...imageNodes, ...subjectNodes];
    const aliases = references.flatMap((reference) =>
      promptReferenceAliases(reference).map((label) => ({ reference, label })),
    ).sort((left, right) => right.label.length - left.label.length);
    const aliasPattern = [...new Set(aliases.map((item) => item.label))]
      .map(escapeRegExp).join("|");
    const pattern = new RegExp(
      `\\[(角色名|角色|场景名|场景|道具名|道具)\\]\\s*|\\[([^\\]\\n]+)\\]${aliasPattern ? `|${aliasPattern}` : ""}`,
      "g",
    );
    const findReference = (label: string, category = "") => aliases.find((item) => {
      if (item.label !== label) return false;
      const title = item.reference.data.title || "";
      if (category.startsWith("场景")) return title.includes("场景");
      if (category.startsWith("道具")) return title.includes("道具");
      if (category.startsWith("角色")) return !title.includes("场景");
      return true;
    })?.reference;
    const makeToken = (reference: PromptReference): EditorToken => {
      const referenceData = reference.data;
      const isSubject = reference.type === NodeType.SubjectNode;
      return {
        id: reference.id,
        kind: "subject",
        label: promptReferenceLabel(reference) || reference.id,
        description: "description" in referenceData ? referenceData.description : undefined,
        url: "url" in referenceData ? referenceData.url : undefined,
        referenceKind: isSubject ? "subject" : "image",
      };
    };
    const content: Array<string | EditorToken> = [];
    let cursor = 0;
    let replaced = false;

    for (const match of initialPrompt.matchAll(pattern)) {
      const index = match.index;
      if (index < cursor) continue;
      const category = match[1] || "";
      let reference: PromptReference | undefined;
      let end = index + match[0].length;
      if (category) {
        const following = initialPrompt.slice(end);
        const candidate = aliases.find((item) =>
          following.startsWith(item.label) && findReference(item.label, category),
        );
        reference = candidate && findReference(candidate.label, category);
        if (candidate) end += candidate.label.length;
      } else {
        reference = findReference((match[2] ?? match[0]).trim());
      }
      content.push(initialPrompt.slice(cursor, index));
      if (!reference) {
        content.push(match[0]);
      } else {
        content.push(makeToken(reference));
        replaced = true;
      }
      cursor = reference ? end : index + match[0].length;
    }
    content.push(initialPrompt.slice(cursor));
    if (replaced) {
      const timer = window.setTimeout(() => editorRef.current?.replaceContent(content), 0);
      return () => window.clearTimeout(timer);
    }
  }, [editorRef, imageNodes, initialPrompt, subjectNodes]);

  useEffect(() => {
    const content = editorRef.current?.getContent();
    if (!content?.tokens.length) return;
    const references = new Map([...imageNodes, ...subjectNodes].map((reference) => [reference.id, reference]));
    let changed = false;
    const tokens = content.tokens.map((token) => {
      const reference = references.get(token.id);
      if (!reference) return token;
      const referenceData = reference.data;
      const isSubject = reference.type === NodeType.SubjectNode;
      const nextToken = {
        ...token,
        label: promptReferenceLabel(reference) || token.label,
        description: "description" in referenceData ? referenceData.description : undefined,
        url: "url" in referenceData ? referenceData.url : undefined,
        referenceKind: isSubject ? "subject" as const : "image" as const,
      };
      if (nextToken.label !== token.label || nextToken.description !== token.description || nextToken.url !== token.url || nextToken.referenceKind !== token.referenceKind) {
        changed = true;
      }
      return nextToken;
    });
    if (changed) editorRef.current?.syncTokens(tokens, undefined, false);
  }, [editorRef, imageNodes, subjectNodes]);

  useEffect(() => {
    if (active) return;
    setToolboxOpen(null);
    setReferenceMenuPosition(null);
    setPreviewReference(null);
  }, [active]);

  // 进入画布时从后端 SQLite 加载模型配置
  useEffect(() => {
    void useModelStore.getState().loadModels();
  }, []);

  const isMedia = type === NodeType.ImageNode || type === NodeType.VideoNode;
  const imageEditorMode = usePipelineStore((state) =>
    state.imageEditor?.nodeId === id && type === NodeType.ImageNode
      ? state.imageEditor.mode
      : null,
  );
  const isFirstAndLastFrame =
    type === NodeType.VideoNode &&
    data.config?.videoMode === VideoModeType.FirstAndLastFrameToVideo;
  const textModels = models.filter(
    (model) => model.category === ModelCategory.Text && model.enabled,
  );
  const defaultTextModel =
    textModels.find(
      (model) => model.id === defaults[ModelCategory.Text],
    ) ?? textModels[0];
  const textModel = data.config?.model ?? defaultTextModel?.name;
  const textScene =
    TEXT_SCENES.find((item) => item.value === data.config?.scene) ??
    TEXT_SCENES[0];
  const imageModels = models.filter(
    (model) => model.category === ModelCategory.Image && model.enabled,
  );
  const defaultImageModel =
    imageModels.find(
      (model) => model.id === defaults[ModelCategory.Image],
    ) ?? imageModels[0];
  const imageModel = data.config?.model ?? defaultImageModel?.name;
  const videoModels = models.filter(
    (model): model is TModelConfigOf<ModelCategory.Video> =>
      model.category === ModelCategory.Video && model.enabled,
  );
  const defaultVideoModel =
    videoModels.find(
      (model) => model.id === defaults[ModelCategory.Video],
    ) ?? videoModels[0];
  const videoModel = data.config?.model ?? defaultVideoModel?.name;
  const selectedVideoModel = videoModels.find((model) => model.name === videoModel) ?? defaultVideoModel;
  const videoResolutions = selectedVideoModel?.modelId === "MiniMax-H3"
    ? ["768P", "2K"]
    : selectedVideoModel?.modelId === "viduq3-turbo"
      ? ["720P", "1080P"]
    : selectedVideoModel?.params.resolutions?.length
      ? selectedVideoModel.params.resolutions
      : ["480P", "720P", "1080P"];
  const videoDurations = Array.from({ length: 12 }, (_, index) => index + 4);
  const audioModels = models.filter(
    (model) => model.category === ModelCategory.Audio && model.enabled,
  );
  const defaultAudioModel =
    audioModels.find(
      (model) => model.id === defaults[ModelCategory.Audio],
    ) ?? audioModels[0];
  const audioModel = data.config?.model ?? defaultAudioModel?.name;

  const changeConfig = (config: TNodeBase["config"]) => {
    const next = { ...data.config, ...config };
    setNodes(
      (nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, config: next } } : n,
        ) as TAllNodes[],
    );
  };

  useEffect(() => {
    if (type !== NodeType.VideoNode || !selectedVideoModel) return;
    const patch: TNodeBase["config"] = {};
    if (!data.config?.resolution || !videoResolutions.includes(data.config.resolution)) {
      patch.resolution = videoResolutions[0];
    }
    if (!data.config?.duration || !videoDurations.includes(data.config.duration)) {
      patch.duration = videoDurations[0];
    }
    if (Object.keys(patch).length) changeConfig(patch);
  }, [type, selectedVideoModel?.id]);

  // + 添加参考：上传图片并在节点左侧生成相连的图片节点作为参考素材
  const handleUploadReference = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const current = getNode(id);
    const position = current
      ? { x: current.position.x - 320, y: current.position.y + (imagePreset ? imageNodes.length * 80 : 0) }
      : { x: 0, y: 0 };
    const refId = nanoid();
    setNodes(
      (nodes) =>
        nodes.concat({
          id: refId,
          type: NodeType.ImageNode,
          position,
          data: { url, status: ChunkStatus.SUCCESS },
        } as TAllNodes) as TAllNodes[],
    );
    if (imagePreset) {
      setEdges((edges) => edges.concat({
        id: nanoid(),
        source: refId,
        sourceHandle: SOURCE_RIGHT_ANCHOR,
        target: id,
        targetHandle: TARGET_LEFT_ANCHOR,
      }));
    }
  };

  const isGenerating = "status" in data && data.status === ChunkStatus.PROCESSING;
  const canSubmit = !disabled && !isGenerating && !isOptimizing;

  const references = useStore(
    (state) => Array.from(state.nodeLookup.values()).flatMap<SubjectReference>((node) => {
      if (
        (type === NodeType.ImageNode || type === NodeType.VideoNode) &&
        node.id === id
      ) {
        return [];
      }
      const kinds: Partial<Record<NodeType, ReferenceKind>> = {
        [NodeType.SubjectNode]: "subject",
        [NodeType.ImageNode]: "image",
        [NodeType.VideoNode]: "video",
        [NodeType.AudioNode]: "audio",
        [NodeType.TextNode]: "text",
      };
      const kind = kinds[node.type as NodeType];
      if (!kind) return [];
      const referenceData = node.data as TNodeBase & {
        name?: string;
        description?: string;
        text?: string;
        url?: string;
      };
      return [{
        id: node.id,
        kind,
        name: (kind === "subject" ? referenceData.name : referenceData.title) || node.id,
        description: kind === "text" ? referenceData.text : referenceData.description,
        url: referenceData.url,
      }];
    }),
    areReferencesEqual,
  );

  const openReferenceMenu = () => {
    const caret = editorRef.current?.getCaretRect();
    if (!caret) return;
    setReferenceMenuPosition({
      left: Math.min(window.innerWidth - 272, Math.max(16, caret.left - 128)),
      top: caret.top,
    });
  };

  const triggerReferenceMenu = () => {
    editorRef.current?.insertText("@");
    window.setTimeout(openReferenceMenu, 0);
  };

  const referenceMenuOpen = referenceMenuPosition !== null;
  useEffect(() => {
    if (!referenceMenuOpen) return;
    let frame = 0;
    const syncPosition = () => {
      const caret = editorRef.current?.getCaretRect();
      if (caret) {
        const left = Math.min(
          window.innerWidth - 272,
          Math.max(16, caret.left - 128),
        );
        setReferenceMenuPosition((current) =>
          current?.left === left && current.top === caret.top
            ? current
            : { left, top: caret.top },
        );
      }
      frame = requestAnimationFrame(syncPosition);
    };
    frame = requestAnimationFrame(syncPosition);
    return () => cancelAnimationFrame(frame);
  }, [referenceMenuOpen]);

  // 工具箱选择写回节点 config
  const confirmToolbox = (patch: Partial<TCameraSelection> | string | TPaletteSelection | null) => {
    const toolbox = { ...data.config?.toolbox };
    if (toolboxOpen === "camera") {
      toolbox.camera = patch as TCameraSelection;
    } else if (toolboxOpen === "palette") {
      if (patch) toolbox.palette = patch as TPaletteSelection;
      else delete toolbox.palette;
    } else if (toolboxOpen === "style") {
      toolbox.style = patch as string;
    } else if (toolboxOpen === "movement") {
      toolbox.movement = patch as string;
    }
    changeConfig({ toolbox });
    setToolboxOpen(null);
  };

  const expandButton = (
    <button
      aria-label="展开"
      className="flex size-7 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
    >
      <Maximize2 size={13} />
    </button>
  );

  const optimizeButton = (
    <button
      aria-label={isOptimizing ? "正在优化提示词" : "优化提示词"}
      title={isOptimizing ? "正在优化提示词" : "优化提示词"}
      onClick={() => void optimizePrompt()}
      disabled={isGenerating || isOptimizing}
      className={`flex size-7 items-center justify-center rounded transition-colors disabled:cursor-not-allowed ${
        isOptimizing
          ? "bg-white/10 text-white"
          : "text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40"
      }`}
    >
      {isOptimizing ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
    </button>
  );

  if (imageEditorMode === "edit") {
    return <MarkerEditor node={node as TNodeImage} onSubmit={() => void submit()} />;
  }
  if (imageEditorMode === "outpaint") {
    return <OutpaintEditor node={node as TNodeImage} onSubmit={() => void submit()} />;
  }
  if (imageEditorMode === "upscale") {
    return <UpscaleEditor node={node as TNodeImage} onSubmit={() => void submit()} />;
  }
  if (imageEditorMode === "cutout") {
    return null;
  }

  return (
    <div className="nodrag nopan nowheel pointer-events-auto w-[560px] rounded-2xl bg-[#1c1c1e] border border-white/5 p-3 shadow-2xl">
      {isMedia && !imagePreset && !pillsCollapsed && (
        <ToolPills
          type={type}
          onCollapse={() => setPillsCollapsed(true)}
          onOpen={setToolboxOpen}
        />
      )}

      {/* 导演工具箱弹窗（相机 / 配色 / 风格） */}
      <CameraModal
        open={toolboxOpen === "camera"}
        value={data.config?.toolbox?.camera}
        onClose={() => setToolboxOpen(null)}
        onConfirm={confirmToolbox}
      />
      <MovementModal
        open={toolboxOpen === "movement"}
        value={data.config?.toolbox?.movement}
        onClose={() => setToolboxOpen(null)}
        onConfirm={confirmToolbox}
      />
      <PaletteModal
        open={toolboxOpen === "palette"}
        value={data.config?.toolbox?.palette}
        onClose={() => setToolboxOpen(null)}
        onConfirm={confirmToolbox}
      />
      <StyleModal
        open={toolboxOpen === "style"}
        value={data.config?.toolbox?.style}
        onClose={() => setToolboxOpen(null)}
        onConfirm={confirmToolbox}
      />
      {isFirstAndLastFrame && (
        <Frame
          config={data.config}
          images={imageNodes}
          action={expandButton}
          changeConfig={changeConfig}
        />
      )}

      {/* 输入区：+ 参考按钮在左上，展开按钮在右上，编辑器整行位于下方（对齐即梦） */}
      <div className="relative">
        <div className="flex items-start justify-between">
          {!isFirstAndLastFrame && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {type === NodeType.VideoNode && videoNodes.map((video, index) => {
                const title = video.data.title || `视频 ${index + 1}`;
                return video.data.url ? (
                  <button
                    key={video.id}
                    type="button"
                    title={`预览${title}`}
                    onClick={() => setPreviewReference({ kind: "video", title, url: video.data.url })}
                    className="group relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black"
                  >
                    <video
                      src={video.data.url}
                      preload="metadata"
                      muted
                      playsInline
                      className="pointer-events-none size-full object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/10">
                      <Play size={16} fill="currentColor" className="text-white drop-shadow" />
                    </span>
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/65 px-1 py-0.5 text-[9px] leading-3 text-white/90">
                      {title}
                    </span>
                  </button>
                ) : null;
              })}
              {[...imageNodes, ...subjectNodes].map((image, index) => {
                const title = image.data.title || ("name" in image.data ? image.data.name : "") || `图片 ${index + 1}`;
                const url = image.data.url;
                return (
                  <button
                    key={image.id}
                    type="button"
                    title={url ? `预览${title}` : `等待生成${title}`}
                    disabled={!url}
                    onClick={() => url && setPreviewReference({ kind: "image", title, url })}
                    className="group relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black disabled:cursor-default"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={title}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <span className="grid size-full place-items-center text-white/30">
                        <ImageIcon size={18} />
                      </span>
                    )}
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/65 px-1 py-0.5 text-left text-[9px] leading-3 text-white/90">
                      {title}
                    </span>
                  </button>
                );
              })}
              <button
                aria-label="添加参考"
                onClick={() => fileRef.current?.click()}
                className="size-12 shrink-0 overflow-hidden rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Plus size={18} />
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isMedia && !imagePreset && pillsCollapsed && (
              <button
                aria-label="展开工具"
                onClick={() => setPillsCollapsed(false)}
                className="flex size-7 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {type === NodeType.VideoNode ? (
                  <Video size={14} />
                ) : (
                  <Camera size={14} />
                )}
              </button>
            )}
            {!isFirstAndLastFrame && expandButton}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadReference}
        />
        <div
          onClick={(e) => {
            // 兜底：点击输入区任意位置都聚焦编辑器
            const editable = e.currentTarget.querySelector<HTMLElement>(
              "[contenteditable]",
            );
            if (editable && document.activeElement !== editable) {
              editable.focus();
            }
          }}
          className="relative mt-1 min-h-12 max-h-40 overflow-y-auto cursor-text"
        >
          <div className="flex min-h-12 items-start gap-2">
            {imagePreset && ImagePresetIcon && (
              <span className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-md bg-white/[0.06] px-2 text-xs text-white/75">
                <ImagePresetIcon size={13} />
                {imagePreset.label}
              </span>
            )}
            <div className="relative min-w-0 flex-1">
              <Editor
                key={`${id}:${data.production?.prompt ?? ""}:${legacyPrompt}`}
                ref={editorRef}
                onSubmit={canSubmit ? submit : () => {}}
                images={imageNodes}
                initialState={data.draftState || superjson.stringify(initialPrompt)}
                noImageMention
                onStateChange={(value) => {
                  setNodes((nodes) => nodes.map((node) =>
                    node.id === id ? { ...node, data: { ...node.data, draftState: value } } : node,
                  ) as TAllNodes[]);
                }}
                onTextChange={(value, referenceQuery) => {
                  setEditorText(value);
                  setNodes((nodes) => nodes.map((node) =>
                    node.id === id ? { ...node, data: { ...node.data, draftText: value } } : node,
                  ) as TAllNodes[]);
                  if (referenceQuery != null) {
                    setReferenceQuery(referenceQuery);
                    window.setTimeout(openReferenceMenu, 0);
                  } else {
                    setReferenceMenuPosition(null);
                  }
                }}
                onEmptyStateChange={setIsEmpty}
                placeholder={NODE_PROMPT_PLACEHOLDER[type]}
                autoFocus={active}
              />
            </div>
          </div>
        </div>
      </div>

      {previewReference && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`预览${previewReference.title}`}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-8 backdrop-blur-sm"
          onClick={() => setPreviewReference(null)}
        >
          <button
            type="button"
            aria-label="关闭预览"
            onClick={() => setPreviewReference(null)}
            className="absolute right-5 top-5 flex size-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X size={18} />
          </button>
          <div
            className="flex max-h-full max-w-[90vw] flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            {previewReference.kind === "video" ? (
              <video
                src={previewReference.url}
                autoPlay
                controls
                playsInline
                className="max-h-[80vh] max-w-[90vw] rounded-xl"
              />
            ) : (
              <img
                src={previewReference.url}
                alt={previewReference.title}
                className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
              />
            )}
            <span className="text-sm text-white/80">{previewReference.title}</span>
          </div>
        </div>,
        document.body,
      )}

      {isOptimizing && (
        <div role="status" aria-live="polite" className="mt-2 flex items-center gap-1.5 text-xs text-white/60">
          <LoaderCircle size={12} className="animate-spin" />
          正在优化提示词，生成内容会自动替换当前文本…
        </div>
      )}
      {optimizationError && <div role="alert" className="mt-2 text-xs text-red-400">{optimizationError}</div>}

      {/* 底部配置条 */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs">
          {type === NodeType.TextNode && (
            <>
              <OptionPopper
                label={textModel || "选择模型"}
                options={textModels.map((model) => model.name)}
                value={textModel}
                onChange={(v) => changeConfig({ model: String(v) })}
              />
              <OptionPopper
                label={textScene.label}
                options={TEXT_SCENES.map((item) => item.label)}
                value={textScene.label}
                onChange={(v) =>
                  changeConfig({
                    scene: TEXT_SCENES.find((item) => item.label === v)?.value,
                  })
                }
              />
            </>
          )}
          {type === NodeType.ImageNode && (
            <>
              <OptionPopper
                label={imageModel || "选择模型"}
                options={imageModels.map((model) => model.name)}
                value={imageModel}
                onChange={(v) => changeConfig({ model: String(v) })}
              />
              <SizeConfig
                config={data.config}
                resolutions={["1K", "2K", "4K"]}
                changeConfig={changeConfig}
              />
              {optimizeButton}
              <button
                aria-label="引用参考"
                onClick={triggerReferenceMenu}
                className="flex size-7 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <AtSign size={14} />
              </button>
            </>
          )}
          {type === NodeType.VideoNode && (
            <>
              <OptionPopper
                label={videoModel || "选择模型"}
                options={videoModels.map((model) => model.name)}
                value={videoModel}
                onChange={(v) => changeConfig({ model: String(v) })}
              />
              <SizeConfig
                config={data.config}
                resolutions={videoResolutions}
                durations={videoDurations}
                changeConfig={changeConfig}
              />
              <VideoConfig config={data.config} changeConfig={changeConfig} />
              {optimizeButton}
              <button
                aria-label="引用参考"
                onClick={triggerReferenceMenu}
                className="flex size-7 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <AtSign size={14} />
              </button>
            </>
          )}
          {type === NodeType.AudioNode && (
            <>
              <OptionPopper label="音频生成" options={["音频生成", "音效生成"]} />
              <OptionPopper
                label={audioModel || "选择模型"}
                options={audioModels.map((model) => model.name)}
                value={audioModel}
                onChange={(v) => changeConfig({ model: String(v) })}
              />
              <OptionPopper label="全能配音" options={["全能配音", "仅人声", "仅配乐"]} />
              <OptionPopper label="音色库" options={["音色库"]} />
              <button
                aria-label="引用参考"
                onClick={triggerReferenceMenu}
                className="flex size-7 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <AtSign size={14} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={isGenerating ? "停止生成" : "生成"}
            aria-busy={isGenerating}
            onClick={isGenerating ? stop : submit}
            disabled={!isGenerating && !canSubmit}
            className={`flex size-8 items-center justify-center rounded-full transition ${
              canSubmit || isGenerating
                ? "bg-white text-black hover:bg-white/90 cursor-pointer"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            {isGenerating ? <Square size={13} fill="currentColor" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>
      {referenceMenuPosition && (
        <ReferencePicker
          references={references}
          position={referenceMenuPosition}
          query={referenceQuery}
          allowedKinds={
            type === NodeType.ImageNode
              ? ["subject", "image"]
              : undefined
          }
          onSelect={(reference) =>
            editorRef.current?.insertToken({
              id: reference.id,
              kind: "subject",
              label: reference.name,
              description: reference.description,
              url: reference.url,
              referenceKind: reference.kind,
            })
          }
          onClose={() => setReferenceMenuPosition(null)}
        />
      )}
    </div>
  );
};

export default memo(GeneratorCard, (previous, next) =>
  previous.node.id === next.node.id &&
  previous.node.type === next.node.type &&
  previous.node.data === next.node.data &&
  previous.active === next.active
);
