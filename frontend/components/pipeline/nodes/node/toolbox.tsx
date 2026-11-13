"use client";

import { memo, useState } from "react";
import { NodeProps, useReactFlow } from "@xyflow/react";
import {
  Camera,
  Paintbrush,
  Play,
  RotateCcw,
  Shapes,
  SlidersHorizontal,
  Video,
} from "lucide-react";
import NodeShell from "./shell";
import { NodeType, TAllNodes, TNodeToolbox, TDirectorNode } from "../../types";
import CameraModal from "../../toolbox/camera-modal";
import PaletteModal from "../../toolbox/palette-modal";
import StyleModal from "../../toolbox/style-modal";
import MovementModal from "../../toolbox/movement-modal";
import {
  CAMERA_COLUMNS,
  CAMERA_DEFAULT,
  MOVEMENTS,
  PALETTES,
  STYLES,
} from "../../toolbox/data";

const NODE_ICONS = {
  [NodeType.CameraNode]: <Camera size={14} />,
  [NodeType.PaletteNode]: <Paintbrush size={14} />,
  [NodeType.StyleNode]: <Shapes size={14} />,
  [NodeType.MovementNode]: <Video size={14} />,
};

const EMPTY_ICONS = {
  [NodeType.PaletteNode]: <Paintbrush size={30} strokeWidth={1.4} />,
  [NodeType.StyleNode]: <Shapes size={30} strokeWidth={1.4} />,
  [NodeType.MovementNode]: <Video size={30} strokeWidth={1.4} />,
};

const STYLE_TAGS: Record<string, string[]> = {
  复古对称美学: ["对称构图", "糖果配色", "机械运镜"],
  "3D动画风": ["立体角色", "柔和光影", "电影质感"],
  治愈日漫风: ["日系动画", "清新色彩", "手绘质感"],
  港夜迷离风: ["霓虹夜景", "港片色调", "氛围光影"],
  哥特式恐怖: ["暗黑场景", "哥特美学", "悬疑氛围"],
  邵氏武侠风: ["武侠动作", "复古胶片", "东方美学"],
  丧尸列车: ["末世场景", "紧张节奏", "电影叙事"],
  美式迷幻青春: ["复古青春", "迷幻色彩", "胶片质感"],
  台湾偶像剧: ["清新人像", "柔光滤镜", "青春氛围"],
  异常阈限空间: ["空旷构图", "低饱和色", "超现实"],
};

type DirectorNodeType =
  | NodeType.CameraNode
  | NodeType.PaletteNode
  | NodeType.StyleNode
  | NodeType.MovementNode;

const EditButton = ({ type, onClick }: { type: DirectorNodeType; onClick: () => void }) => (
  <button
    aria-label={`编辑${type === NodeType.CameraNode ? "相机" : type === NodeType.PaletteNode ? "配色" : type === NodeType.StyleNode ? "风格" : "运镜"}`}
    onClick={onClick}
    className="nodrag absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-lg border border-white/5 bg-black/25 text-white/65 backdrop-blur-sm transition-colors hover:bg-black/45 hover:text-white cursor-pointer"
  >
    {type === NodeType.CameraNode ? <SlidersHorizontal size={16} /> : <RotateCcw size={16} />}
  </button>
);

const ToolboxNode = ({ id, type, data, selected }: NodeProps<TDirectorNode>) => {
  const nodeType = type as DirectorNodeType;
  const { setNodes } = useReactFlow<TAllNodes>();
  const [open, setOpen] = useState(false);
  const toolbox = data.config?.toolbox;
  const camera = { ...CAMERA_DEFAULT, ...toolbox?.camera };
  const cameraOption = CAMERA_COLUMNS[0].options.find((option) => option.label === camera.camera);
  const paletteValue = toolbox?.palette;
  const palette = typeof paletteValue === "string"
    ? PALETTES.find((item) => item.name === paletteValue)
    : paletteValue;
  const paletteImage = PALETTES.find((item) => item.name === palette?.name)?.image;
  const style = STYLES.find((item) => item.name === toolbox?.style);
  const movement = MOVEMENTS.find((item) => item.name === toolbox?.movement);
  const title = nodeType === NodeType.PaletteNode && palette
    ? `${palette.name}配色`
    : nodeType === NodeType.StyleNode && style
      ? `${style.name}风格`
      : nodeType === NodeType.MovementNode && movement
        ? `${movement.name}运镜`
        : data.title;

  const updateToolbox = (patch: TNodeToolbox) => {
    setNodes((nodes) => nodes.map((node) => node.id === id ? {
      ...node,
      data: {
        ...node.data,
        config: {
          ...node.data.config,
          toolbox: { ...node.data.config?.toolbox, ...patch },
        },
      },
    } : node) as TAllNodes[]);
    setOpen(false);
  };

  return (
    <NodeShell id={id} type={nodeType} selected={selected} title={title} icon={NODE_ICONS[nodeType]}>
      <div className={`relative overflow-hidden rounded-2xl border border-white/5 bg-[#292b2c] ${nodeType === NodeType.CameraNode ? "w-[400px]" : "w-[320px]"}`}>
        <EditButton type={nodeType} onClick={() => setOpen(true)} />

        {nodeType === NodeType.CameraNode && (
          <div className="flex h-[220px] items-center px-5 py-6">
            <div className="flex w-[58%] flex-col items-center justify-center gap-3">
              {cameraOption?.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={cameraOption.thumbnail} alt="" className="h-32 w-40 object-contain" />
              ) : (
                <Camera size={64} strokeWidth={1} className="text-white/35" />
              )}
              <span className="text-xs text-white/40">{camera.camera}</span>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-5 pl-3">
              {([["镜头", camera.lens], ["焦距", camera.focal], ["光圈", camera.aperture]] as const).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <div className="text-xs text-white/35">{label}</div>
                  <div className="mt-1 truncate text-sm font-medium text-white/85" title={value}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {nodeType === NodeType.PaletteNode && (palette ? (
          <>
            {paletteImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={paletteImage} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <div className="aspect-video w-full" style={{ background: `linear-gradient(135deg, ${palette.colors.join(",")})` }} />
            )}
            <div className="p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white/85">主色 {palette.colors[0]}</span>
                <span className="text-white/40">{palette.colors.length} 个颜色</span>
              </div>
              <div className="mt-3 flex h-7 items-center gap-2">
                {palette.colors.map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    className={`h-7 rounded-full ${index === 0 ? "flex-[1.6]" : "flex-1"}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 text-white/30">
            {EMPTY_ICONS[nodeType]}
            <span className="text-xs">未设置配色</span>
          </div>
        ))}

        {nodeType === NodeType.StyleNode && (style ? (
          <>
            <div className="relative aspect-video">
              <video src={style.video} poster={style.poster} autoPlay muted loop playsInline className="pointer-events-none h-full w-full object-cover" />
              <Play size={22} fill="white" className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-md" />
            </div>
            <div className="px-4 py-3">
              <div className="text-sm font-medium text-white/90">{style.name}</div>
              <div className="mt-2 flex gap-2 text-[10px] text-white/35">
                {STYLE_TAGS[style.name].map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </div>
          </>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 text-white/30">
            {EMPTY_ICONS[nodeType]}
            <span className="text-xs">未设置风格</span>
          </div>
        ))}

        {nodeType === NodeType.MovementNode && (movement ? (
          <div className="relative aspect-square">
            <video src={movement.video} poster={movement.image} autoPlay muted loop playsInline className="pointer-events-none h-full w-full object-cover" />
            <Play size={22} fill="white" className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-md" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pt-10 pb-3 text-center text-xs text-white/90">
              {movement.name}
            </div>
          </div>
        ) : (
          <div className="flex aspect-square flex-col items-center justify-center gap-3 text-white/30">
            {EMPTY_ICONS[nodeType]}
            <span className="text-xs">未设置运镜</span>
          </div>
        ))}
      </div>

      {nodeType === NodeType.CameraNode && (
        <CameraModal open={open} value={toolbox?.camera} onClose={() => setOpen(false)} onConfirm={(value) => updateToolbox({ camera: value })} />
      )}
      {nodeType === NodeType.PaletteNode && (
        <PaletteModal open={open} value={paletteValue} onClose={() => setOpen(false)} onConfirm={(value) => updateToolbox({ palette: value ?? undefined })} />
      )}
      {nodeType === NodeType.StyleNode && (
        <StyleModal open={open} value={toolbox?.style} onClose={() => setOpen(false)} onConfirm={(value) => updateToolbox({ style: value })} />
      )}
      {nodeType === NodeType.MovementNode && (
        <MovementModal open={open} value={toolbox?.movement} onClose={() => setOpen(false)} onConfirm={(value) => updateToolbox({ movement: value })} />
      )}
    </NodeShell>
  );
};

export default memo(ToolboxNode);
