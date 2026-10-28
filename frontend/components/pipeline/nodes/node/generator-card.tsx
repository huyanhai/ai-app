"use client";
import { useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  ArrowUp,
  AtSign,
  Camera,
  ChevronDown,
  Maximize2,
  Palette,
  Shapes,
  Sparkles,
  Video,
  Plus,
} from "lucide-react";
import { nanoid } from "nanoid";
import Editor from "../../editor";
import Popper from "../../popper";
import SizeConfig from "../../chat-input/config/size-config";
import VideoConfig from "../../chat-input/config/video-config";
import DurationConfig from "../../chat-input/config/duration-config";
import Frame from "../../chat-input/frame";
import { useGenerate } from "../../hooks/use-generate";
import { NODE_PROMPT_PLACEHOLDER, NODE_PRICE } from "../../constants";
import {
  NodeType,
  TAllNodes,
  TNodeBase,
  VideoModeType,
} from "../../types";
import { BUTTON_ACTIVE, BUTTON_NORMAL } from "@/constants/class-names";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";

// 可在此表单中生成的节点类型
export const GENERATOR_TYPES: NodeType[] = [
  NodeType.TextNode,
  NodeType.ImageNode,
  NodeType.VideoNode,
  NodeType.AudioNode,
];

// 简单的选项弹层（模型 / 清晰度 / 数量等）
const OptionPopper = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: (string | number)[];
  value?: string | number;
  onChange?: (v: string | number) => void;
}) => (
  <Popper
    content={label}
    trigger={
      <div className="flex flex-col gap-1 min-w-24">
        {options.map((item) => (
          <div
            key={item}
            className={`px-3 py-2 text-xs ${BUTTON_NORMAL} ${
              value === item ? BUTTON_ACTIVE : ""
            }`}
            onClick={() => onChange?.(item)}
          >
            {item}
          </div>
        ))}
      </div>
    }
  />
);

// 即梦风格顶部导演工具 pill（相机 / 配色 / 风格 / 运镜），嵌在卡片顶部整行铺满
const ToolPills = ({
  type,
  onCollapse,
}: {
  type: NodeType;
  onCollapse: () => void;
}) => {
  const pills =
    type === NodeType.ImageNode
      ? [
          { icon: <Camera size={14} />, label: "相机" },
          { icon: <Palette size={14} />, label: "配色" },
          { icon: <Shapes size={14} />, label: "风格" },
        ]
      : [
          { icon: <Palette size={14} />, label: "配色" },
          { icon: <Shapes size={14} />, label: "风格" },
          { icon: <Video size={14} />, label: "运镜 添加 +" },
        ];

  return (
    <div className="mb-2 flex items-center gap-2">
      {pills.map((pill) => (
        <button
          key={pill.label}
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
const GeneratorCard = ({ node }: { node: TAllNodes }) => {
  const id = node.id;
  const type = node.type as NodeType;
  const data = node.data;

  const { setNodes, getNode } = useReactFlow<TAllNodes>();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pillsCollapsed, setPillsCollapsed] = useState(false);
  const { editorRef, submit, disabled, setIsEmpty, imageNodes } = useGenerate(
    id,
    type,
    data,
  );

  const isMedia = type === NodeType.ImageNode || type === NodeType.VideoNode;

  const changeConfig = (config: TNodeBase["config"]) => {
    const next = { ...data.config, ...config };
    setNodes(
      (nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, config: next } } : n,
        ) as TAllNodes[],
    );
  };

  // + 添加参考：上传图片并在节点左侧生成相连的图片节点作为参考素材
  const handleUploadReference = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const current = getNode(id);
    const position = current
      ? { x: current.position.x - 320, y: current.position.y }
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
  };

  const noImageMention =
    type === NodeType.VideoNode &&
    [VideoModeType.FirstAndLastFrameToVideo, VideoModeType.TextToVideo].includes(
      data.config?.videoMode!,
    );

  const canSubmit = type !== NodeType.AudioNode && !disabled;

  return (
    <div className="nodrag nopan nowheel w-[560px] rounded-2xl bg-[#1c1c1e] border border-white/5 p-3 shadow-2xl">
      {isMedia && !pillsCollapsed && (
        <ToolPills type={type} onCollapse={() => setPillsCollapsed(true)} />
      )}
      {type === NodeType.VideoNode &&
        data.config?.videoMode === VideoModeType.FirstAndLastFrameToVideo && (
          <Frame config={data.config} changeConfig={changeConfig} />
        )}

      {/* 输入区：+ 参考按钮在左上，展开按钮在右上，编辑器整行位于下方（对齐即梦） */}
      <div className="relative">
        <div className="flex items-start justify-between">
          <button
            aria-label="添加参考"
            onClick={() => fileRef.current?.click()}
            className="size-12 shrink-0 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Plus size={18} />
          </button>
          <div className="flex items-center gap-2">
            {isMedia && pillsCollapsed && (
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
            <button
              aria-label="展开"
              className="text-white/40 hover:text-white/80 transition-colors cursor-pointer"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadReference}
        />
        <div className="relative mt-1 min-h-12 max-h-40 overflow-y-auto">
          <Editor
            key={id}
            ref={editorRef}
            onSubmit={canSubmit ? submit : () => {}}
            images={imageNodes}
            initialState=""
            noImageMention={noImageMention}
            onEmptyStateChange={setIsEmpty}
            placeholder={NODE_PROMPT_PLACEHOLDER[type]}
            autoFocus={false}
          />
        </div>
      </div>

      {/* 底部配置条 */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs">
          {type === NodeType.ImageNode && (
            <>
              <OptionPopper
                label={data.config?.model || "Seedream 5.0 Lite"}
                options={["Seedream 5.0 Lite", "Seedream 4.5", "Seedream 4.0"]}
                value={data.config?.model}
                onChange={(v) => changeConfig({ model: String(v) })}
              />
              <SizeConfig
                config={data.config}
                resolutions={["1K", "2K", "4K"]}
                changeConfig={changeConfig}
              />
              <button
                aria-label="引用参考"
                className="flex size-7 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <AtSign size={14} />
              </button>
            </>
          )}
          {type === NodeType.VideoNode && (
            <>
              <OptionPopper
                label={data.config?.model || "即梦 Seedance 2.0"}
                options={["即梦 Seedance 2.0", "即梦 Seedance 2.0 Fast"]}
                value={data.config?.model}
                onChange={(v) => changeConfig({ model: String(v) })}
              />
              <SizeConfig
                config={data.config}
                resolutions={["720P", "1080P"]}
                changeConfig={changeConfig}
              />
              <VideoConfig config={data.config} changeConfig={changeConfig} />
              <DurationConfig
                config={data.config}
                changeConfig={changeConfig}
              />
              <button
                aria-label="引用参考"
                className="flex size-7 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <AtSign size={14} />
              </button>
            </>
          )}
          {type === NodeType.AudioNode && (
            <>
              <OptionPopper label="音频生成" options={["音频生成", "音效生成"]} />
              <OptionPopper label="SeedAudio 1.0" options={["SeedAudio 1.0"]} />
              <OptionPopper label="全能配音" options={["全能配音", "仅人声", "仅配乐"]} />
              <OptionPopper label="音色库" options={["音色库"]} />
              <button
                aria-label="引用参考"
                className="flex size-7 items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <AtSign size={14} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {NODE_PRICE[type] && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <Sparkles size={11} />
              {NODE_PRICE[type]}
            </span>
          )}
          <button
            aria-label="生成"
            onClick={submit}
            disabled={!canSubmit}
            title={
              type === NodeType.AudioNode ? "音频生成暂未接入" : undefined
            }
            className={`flex size-8 items-center justify-center rounded-full transition ${
              canSubmit
                ? "bg-white text-black hover:bg-white/90 cursor-pointer"
                : "bg-white/10 text-white/30 cursor-not-allowed"
            }`}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneratorCard;
