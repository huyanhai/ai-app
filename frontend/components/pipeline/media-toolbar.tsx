"use client";

import { useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Download, Expand, LayoutDashboard, Orbit, ScanLine, Scissors, WandSparkles } from "lucide-react";
import { nanoid } from "nanoid";
import { IconButton } from "@/components/ui/icon-button";
import { NodeType, Placement, TAllNodes, TNodeImage } from "./types";
import { usePipelineStore } from "@/store/pipeline-store";
import { originalSize } from "./nodes/node/image/outpaint-canvas";
import { IMAGE_PRESETS, type ImagePreset } from "./nodes/node/image/presets";
import Popper, { type IPopperRef } from "./popper";
import { SOURCE_RIGHT_ANCHOR, TARGET_LEFT_ANCHOR } from "./constants";
import MultiAngleModal, { type MultiAngleParams } from "./nodes/node/image/multi-angle-modal";
import { sseFetch } from "@/lib/sse";
import { getImageModel, isModelReady } from "@/store/model-store";
import { ChunkStatus, type IMediaData } from "backend/src/common/utils/ai-stream-utils";

const MediaToolbar = ({ node }: { node: TAllNodes }) => {
  const { zoomTo, setNodes, setEdges } = useReactFlow<TAllNodes>();
  const presetPopperRef = useRef<IPopperRef>(null);
  const [downloading, setDownloading] = useState(false);
  const [multiAngleOpen, setMultiAngleOpen] = useState(false);
  const imageEditor = usePipelineStore((state) => state.imageEditor);
  const setImageEditor = usePipelineStore((state) => state.setImageEditor);
  const url = "url" in node.data ? node.data.url : "";
  const extension =
    node.type === NodeType.ImageNode
      ? "png"
      : node.type === NodeType.VideoNode
        ? "mp4"
        : "mp3";

  const download = async () => {
    if (!url || downloading) return;
    setDownloading(true);
    const anchor = document.createElement("a");
    anchor.download = `${node.data.title || "生成结果"}.${extension}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("下载失败");
      const objectUrl = URL.createObjectURL(await response.blob());
      anchor.href = objectUrl;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.click();
    } finally {
      setDownloading(false);
    }
  };

  const createPresetNode = (preset: ImagePreset) => {
    if (node.type !== NodeType.ImageNode) return;
    const source = node as TNodeImage;
    const id = nanoid();
    const original = originalSize(source.data.config?.ratio);
    setNodes((nodes) => nodes
      .map((item): TAllNodes => ({ ...item, selected: false }))
      .concat({
        id,
        type: NodeType.ImageNode,
        position: { x: source.position.x + original.width + 80, y: source.position.y },
        data: {
          url: "",
          title: `${source.data.title || "图片"}_${preset.label}`,
          preset: preset.id,
          config: {
            ratio: preset.ratio,
            resolution: source.data.config?.resolution ?? "2K",
            count: source.data.config?.count ?? 1,
            model: source.data.config?.model,
          },
        },
        selected: true,
      } as TNodeImage));
    setEdges((edges) => edges.concat({
      id: nanoid(),
      source: source.id,
      sourceHandle: SOURCE_RIGHT_ANCHOR,
      target: id,
      targetHandle: TARGET_LEFT_ANCHOR,
    }));
    presetPopperRef.current?.closePopper();
  };

  const generateMultiAngle = (params: MultiAngleParams) => {
    if (node.type !== NodeType.ImageNode) return;
    const source = node as TNodeImage;
    const id = nanoid();
    const original = originalSize(source.data.config?.ratio);
    const selectedModel = getImageModel(source.data.config?.model);
    setNodes((nodes) => nodes
      .map((item): TAllNodes => ({ ...item, selected: false }))
      .concat({
        id,
        type: NodeType.ImageNode,
        position: { x: source.position.x + original.width + 80, y: source.position.y },
        data: {
          url: "",
          title: `${source.data.title || "图片"}_多角度`,
          status: selectedModel && isModelReady(selectedModel) ? ChunkStatus.PROCESSING : ChunkStatus.FAILED,
          error: selectedModel && isModelReady(selectedModel) ? undefined : "未配置可用的模型，请先在 配置 → 模型配置 中完善",
          config: {
            ratio: source.data.config?.ratio ?? "1:1",
            resolution: source.data.config?.resolution ?? "2K",
            count: 1,
            model: source.data.config?.model,
          },
        },
        selected: true,
      } as TNodeImage));
    setEdges((edges) => edges.concat({
      id: nanoid(),
      source: source.id,
      sourceHandle: SOURCE_RIGHT_ANCHOR,
      target: id,
      targetHandle: TARGET_LEFT_ANCHOR,
    }));
    if (!selectedModel || !isModelReady(selectedModel)) return;

    const updateResult = (data: Partial<TNodeImage["data"]>) => {
      setNodes((nodes) => nodes.map((item) => item.id === id && item.type === NodeType.ImageNode
        ? { ...item, data: { ...item.data, ...data } }
        : item) as TAllNodes[]);
    };
    const prompt = `基于参考图生成同一主体的新视角图片，严格保持主体身份、外观、服装、色彩和整体风格一致。摄像机方位：${params.direction}；水平角度：${params.horizontal}度；垂直角度：${params.vertical}度；景别：${params.zoom}。只改变摄像机视角和对应构图，保持画面自然、主体完整，不要改变主体特征。`;
    void sseFetch({
      url: "/pipeline/image",
      body: JSON.stringify({
        message: [
          { type: "image_url", image_url: source.data.url },
          { type: "text", text: prompt },
        ],
        config: {
          ratio: source.data.config?.ratio ?? "1:1",
          resolution: source.data.config?.resolution ?? "2K",
          count: 1,
          edit: true,
          preset: "multi-angle",
        },
        modelId: selectedModel.id,
        textList: [],
      }),
      abortController: new AbortController(),
      cb: (event) => {
        if (event.type === "msg_chunk") {
          const { url, status } = event.content as IMediaData;
          updateResult({ url, status });
        }
        if (event.type === "msg_error") {
          updateResult({ status: ChunkStatus.FAILED, error: event.error });
        }
      },
    }).catch((error) => updateResult({
      status: ChunkStatus.FAILED,
      error: error instanceof Error ? error.message : String(error),
    }));
  };

  if (imageEditor?.nodeId === node.id || ("preset" in node.data && node.data.preset)) return null;

  return (
    <div className="nodrag flex items-center rounded-xl border border-white/5 bg-[#26262a] p-1 shadow-2xl">
      {node.type === NodeType.ImageNode && (
        <IconButton
          label="智能改图"
          active={imageEditor?.nodeId === node.id && imageEditor.mode === "edit"}
          disabled={!url}
          onClick={() => {
            const editing = imageEditor?.nodeId !== node.id || imageEditor.mode !== "edit";
            setImageEditor(editing ? { nodeId: node.id, mode: "edit" } : null);
            if (editing) void zoomTo(1.5, { duration: 300 });
          }}
          className="h-7 w-auto gap-1.5 whitespace-nowrap px-2 text-xs text-white/70"
        >
          <WandSparkles size={13} />
          智能改图
        </IconButton>
      )}
      {node.type === NodeType.ImageNode && (
        <IconButton
          label="智能超清"
          disabled={!url}
          onClick={() => {
            const editing = imageEditor?.nodeId !== node.id || imageEditor.mode !== "upscale";
            setImageEditor(editing ? { nodeId: node.id, mode: "upscale" } : null);
          }}
          className="h-7 w-auto gap-1.5 whitespace-nowrap px-2 text-xs text-white/70"
        >
          <ScanLine size={13} />
          智能超清
        </IconButton>
      )}
      {node.type === NodeType.ImageNode && (
        <IconButton
          label="抠图"
          disabled={!url}
          onClick={() => setImageEditor({ nodeId: node.id, mode: "cutout" })}
          className="h-7 w-auto gap-1.5 whitespace-nowrap px-2 text-xs text-white/70"
        >
          <Scissors size={13} />
          抠图
        </IconButton>
      )}
      {node.type === NodeType.ImageNode && (
        <IconButton
          label="扩图"
          active={imageEditor?.nodeId === node.id && imageEditor.mode === "outpaint"}
          disabled={!url}
          onClick={() => {
            const editing = imageEditor?.nodeId !== node.id || imageEditor.mode !== "outpaint";
            if (editing && node.type === NodeType.ImageNode) {
              const data = node.data as TNodeImage["data"];
              const original = originalSize(data.config?.ratio);
              const width = data.outpaintWidth ?? original.width * 2;
              const height = data.outpaintHeight ?? original.height * 2;
              setNodes((nodes) => nodes.map((item) =>
                item.id === node.id && item.type === NodeType.ImageNode
                  ? {
                      ...item,
                      data: {
                        ...item.data,
                        outpaintX: (original.width - width) / 2,
                        outpaintY: (original.height - height) / 2,
                      },
                    }
                  : item,
              ) as TAllNodes[]);
            }
            setImageEditor(editing ? { nodeId: node.id, mode: "outpaint" } : null);
          }}
          className="h-7 w-auto gap-1.5 whitespace-nowrap px-2 text-xs text-white/70"
        >
          <Expand size={13} />
          扩图
        </IconButton>
      )}
      {node.type === NodeType.ImageNode && url && (
        <Popper
          ref={presetPopperRef}
          preferredPlacement={Placement.Bottom}
          content={<span className="flex h-7 items-center gap-1.5 px-1 text-white/70"><LayoutDashboard size={13} />预设</span>}
          trigger={
            <div className="w-56 p-1.5">
              {IMAGE_PRESETS.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.id}
                    onClick={() => createPresetNode(preset)}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Icon size={15} />
                    {preset.label}
                  </button>
                );
              })}
            </div>
          }
        />
      )}
      {node.type === NodeType.ImageNode && (
        <IconButton
          label="多角度"
          disabled={!url}
          onClick={() => setMultiAngleOpen(true)}
          className="h-7 w-auto gap-1.5 whitespace-nowrap px-2 text-xs text-white/70"
        >
          <Orbit size={13} />
          多角度
        </IconButton>
      )}
      <IconButton
        label="下载"
        disabled={!url || downloading}
        onClick={() => void download()}
        className="size-7 text-white/70"
      >
        <Download size={13} />
      </IconButton>
      {node.type === NodeType.ImageNode && (
        <MultiAngleModal
          node={node as TNodeImage}
          open={multiAngleOpen}
          onClose={() => setMultiAngleOpen(false)}
          onGenerate={generateMultiAngle}
        />
      )}
    </div>
  );
};

export default MediaToolbar;
