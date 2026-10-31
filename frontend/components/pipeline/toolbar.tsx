"use client";
import { Fragment, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  AudioLines,
  Box,
  Camera,
  Clapperboard,
  Image,
  Library,
  ListVideo,
  Paintbrush,
  Palette,
  ScanFace,
  Shapes,
  Type,
  Upload,
  Video,
} from "lucide-react";
import { nanoid } from "nanoid";
import { AnimatePresence, motion } from "motion/react";
import {
  NODE_DEFAULT_DATA,
  NODE_TYPE_LABEL,
} from "./constants";
import { NodeType, TAllNodes } from "./types";
import { usePipelineStore } from "@/store/pipeline-store";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";

type TToolId =
  | NodeType.TextNode
  | NodeType.ImageNode
  | NodeType.VideoNode
  | NodeType.AudioNode
  | NodeType.TimelineNode
  | NodeType.SubjectNode
  | "toolbox"
  | NodeType.StageNode
  | "assets"
  | "upload";

interface ITool {
  id: TToolId;
  label: string;
  icon: React.ReactNode;
  beta?: boolean;
  dot?: boolean;
}

const TOOLS: ITool[] = [
  { id: NodeType.TextNode, label: "文本", icon: <Type size={18} /> },
  { id: NodeType.ImageNode, label: "图片", icon: <Image size={18} /> },
  { id: NodeType.VideoNode, label: "视频", icon: <Clapperboard size={18} /> },
  { id: NodeType.AudioNode, label: "音频", icon: <AudioLines size={18} /> },
  { id: NodeType.TimelineNode, label: "时间线", icon: <ListVideo size={18} /> },
  { id: NodeType.SubjectNode, label: "主体", icon: <ScanFace size={18} /> },
  { id: "toolbox", label: "导演工具箱", icon: <Palette size={18} />, dot: true },
  { id: NodeType.StageNode, label: "导演台", icon: <Box size={18} />, beta: true },
  { id: "assets", label: "资产库", icon: <Library size={18} /> },
  { id: "upload", label: "上传", icon: <Upload size={18} /> },
];

const TOOLBOX_ITEMS = [
  { icon: <Camera size={14} />, label: "相机" },
  { icon: <Paintbrush size={14} />, label: "配色" },
  { icon: <Shapes size={14} />, label: "风格" },
  { icon: <Video size={14} />, label: "运镜" },
];

// 标签列：index 8 前插入分隔行（对齐图标列的分隔线位置）
const LABEL_ROWS: (ITool | "separator")[] = [
  ...TOOLS.slice(0, 8),
  "separator",
  ...TOOLS.slice(8),
];

// 即梦风格左侧悬浮工具栏：点击创建节点 / 打开导演工具箱菜单 / 资产库 / 上传
const Toolbar = () => {
  const { screenToFlowPosition, setNodes, getNodes } =
    useReactFlow<TAllNodes>();

  // 按同类型节点数量生成标题：文本 1、图片 2…
  const nextTitle = (type: NodeType) => {
    const count = getNodes().filter((n) => n.type === type).length;
    return `${NODE_TYPE_LABEL[type]} ${count + 1}`;
  };
  const setAssetModalOpen = usePipelineStore((s) => s.setAssetModalOpen);
  const [activeTool, setActiveTool] = useState<TToolId | null>(null);
  const [hoveredTool, setHoveredTool] = useState<TToolId | null>(null);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 在画布可视区域中心创建节点并选中
  const addNodeAtCenter = (type: NodeType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const id = nanoid();
    setNodes(
      (nodes) =>
        nodes
          .map((node): TAllNodes => ({ ...node, selected: false }))
          .concat({
            id,
            type,
            position: { x: position.x - 210, y: position.y - 100 },
            data: {
              ...structuredClone(NODE_DEFAULT_DATA[type]),
              title: nextTitle(type),
            },
            selected: true,
          } as TAllNodes),
    );
    setActiveTool(type as TToolId);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/");
    const type = isVideo ? NodeType.VideoNode : NodeType.ImageNode;
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    setNodes(
      (nodes) =>
        nodes.concat({
          id: nanoid(),
          type,
          position: { x: position.x - 210, y: position.y - 100 },
          data: {
            ...structuredClone(NODE_DEFAULT_DATA[type]),
            title: nextTitle(type),
            url,
            status: ChunkStatus.SUCCESS,
          },
          selected: true,
        } as TAllNodes) as TAllNodes[],
    );
  };

  const handleClick = (tool: ITool) => {
    switch (tool.id) {
      case "toolbox":
        setToolboxOpen((v) => !v);
        return;
      case "assets":
        setAssetModalOpen(true);
        return;
      case "upload":
        fileRef.current?.click();
        return;
      default:
        setToolboxOpen(false);
        addNodeAtCenter(tool.id);
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center nodrag nopan"
    >
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-[#1c1c1e]/95 border border-white/5 backdrop-blur p-1.5 shadow-2xl">
        {TOOLS.map((tool, index) => (
          <Fragment key={tool.id}>
            {index === 8 && <div className="my-1 h-px w-6 bg-white/10" />}
            <button
              aria-label={tool.label}
              onClick={() => handleClick(tool)}
              onMouseEnter={() => setHoveredTool(tool.id)}
              onMouseLeave={() => setHoveredTool(null)}
              className={`relative flex size-9 items-center justify-center rounded-xl transition-colors cursor-pointer ${
                activeTool === tool.id
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tool.icon}
              {tool.dot && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-[#33a3ff]" />
              )}
              {tool.beta && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded bg-white/10 px-1 text-[9px] leading-3 text-white/50">
                  Beta
                </span>
              )}
            </button>
          </Fragment>
        ))}
      </div>

      {/* hover 工具栏时展开的标签列（对齐即梦，点击文字同样创建节点） */}
      <AnimatePresence>
        {hovered && (
          <div className="absolute left-full pl-3 flex flex-col gap-2">
            {LABEL_ROWS.map((row, index) => (
              <motion.div
                key={row === "separator" ? "separator" : row.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{
                  opacity: 0,
                  x: -10,
                  transition: {
                    duration: 0.12,
                    delay: (LABEL_ROWS.length - 1 - index) * 0.02,
                  },
                }}
                transition={{
                  duration: 0.2,
                  delay: index * 0.035,
                  ease: "easeOut",
                }}
              >
                {row === "separator" ? (
                  <div className="my-1 h-px w-0" />
                ) : (
                  <button
                    onClick={() => handleClick(row)}
                    className={`flex h-9 items-center text-sm hover:text-white whitespace-nowrap cursor-pointer ${
                      activeTool === row.id || hoveredTool === row.id
                        ? "text-white"
                        : "text-white/60"
                    }`}
                  >
                    {row.label}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* 导演工具箱二级菜单 */}
      <AnimatePresence>
        {toolboxOpen && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full bottom-16 ml-3 w-40 rounded-xl bg-[#26262a] border border-white/5 p-1.5 shadow-2xl"
          >
            <div className="px-2 py-1.5 text-xs text-white/40">导演工具箱</div>
            {TOOLBOX_ITEMS.map((item) => (
              <button
                key={item.label}
                onClick={() => setToolboxOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,audio/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
};

export default Toolbar;
