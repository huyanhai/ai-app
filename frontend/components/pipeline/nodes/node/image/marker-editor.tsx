"use client";

import { ArrowUp, LoaderCircle, MapPin, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { AnimatePresence, motion } from "motion/react";
import { usePipelineStore } from "@/store/pipeline-store";
import { useModelStore } from "@/store/model-store";
import { ModelCategory } from "@/components/models/types";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import OptionPopper from "../../../option-popper";
import { NODE_PRICE } from "../../../constants";
import Editor, { IEditorRef } from "../../../editor";
import {
  NodeType,
  TAllNodes,
  TImageEditMarker,
  TNodeImage,
} from "../../../types";

const MarkerEditor = ({
  node,
  onSubmit,
}: {
  node: TNodeImage;
  onSubmit: () => void;
}) => {
  const { setNodes } = useReactFlow<TAllNodes>();
  const close = usePipelineStore((state) => state.setImageEditor);
  const models = useModelStore((state) => state.models);
  const defaults = useModelStore((state) => state.defaults);
  const imageModels = models.filter(
    (model) => model.category === ModelCategory.Image && model.enabled,
  );
  const defaultModel =
    imageModels.find((model) => model.id === defaults[ModelCategory.Image]) ??
    imageModels[0];
  const markers = node.data.editMarkers ?? [];
  const past = node.data.editPast ?? [];
  const future = node.data.editFuture ?? [];
  const processing = node.data.status === ChunkStatus.PROCESSING;
  const editorRef = useRef<IEditorRef>(null);
  const syncingTokens = useRef(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const markerSignature = markers.map((marker) => marker.id).join(",");

  useEffect(() => {
    syncingTokens.current = true;
    editorRef.current?.syncTokens(markers.map((marker, index) => ({
      id: marker.id,
      kind: "attachment",
      label: `标记${index + 1}`,
      url: node.data.url,
      marker,
      markerIndex: index + 1,
    })));
    syncingTokens.current = false;
  }, [markerSignature, node.data.url]);

  const updateMarkers = (
    editMarkers: TImageEditMarker[],
    editPast = past,
    editFuture = future,
  ) => {
    setNodes((nodes) =>
      nodes.map((item) =>
        item.id === node.id && item.type === NodeType.ImageNode
          ? { ...item, data: { ...item.data, editMarkers, editPast, editFuture } }
          : item,
      ) as TAllNodes[],
    );
  };

  return (
    <div className="nodrag nopan nowheel pointer-events-auto flex w-200 flex-col items-center gap-3">
      <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-[#26262a] p-1.5 shadow-2xl">
        <div className="flex h-8 items-center gap-2 rounded-lg bg-white/10 px-3 text-sm text-white">
          <MapPin size={15} className="[&_circle]:hidden" />
          标记
        </div>
        <button
          aria-label="撤销标记"
          disabled={!past.length}
          onClick={() => updateMarkers(past.at(-1) ?? [], past.slice(0, -1), [markers, ...future])}
          className="flex size-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white disabled:text-white/20"
        >
          <Undo2 size={16} />
        </button>
        <button
          aria-label="重做标记"
          disabled={!future.length}
          onClick={() => updateMarkers(future[0] ?? [], [...past, markers], future.slice(1))}
          className="flex size-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white disabled:text-white/20"
        >
          <Redo2 size={16} />
        </button>
        <button
          aria-label="退出智能改图"
          onClick={() => close(null)}
          className="flex size-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#1c1c1e] p-3 shadow-2xl">
        <div
          className="relative min-w-48 max-w-full flex-none"
          onMouseOver={(event) => {
            const target = (event.target as HTMLElement).closest<HTMLElement>("[data-marker-id]");
            if (target) setPreviewId(target.dataset.markerId ?? null);
          }}
          onMouseOut={(event) => {
            if (!(event.relatedTarget as HTMLElement | null)?.closest?.("[data-marker-id]")) {
              setPreviewId(null);
            }
          }}
        >
          <Editor
            ref={editorRef}
            images={[]}
            initialState=""
            noImageMention
            placeholder={markers.length ? "输入修改内容" : "在图片上点击或拖框添加标记"}
            onSubmit={onSubmit}
            onTokenRemove={(token) => {
              if (syncingTokens.current || !token.marker) return;
              updateMarkers(
                markers.filter((marker) => marker.id !== token.id),
                [...past, markers],
                [],
              );
            }}
            onTextChange={(editPrompt) => {
              setNodes((nodes) => nodes.map((item) =>
                item.id === node.id
                  ? { ...item, data: { ...item.data, editPrompt } }
                  : item,
              ) as TAllNodes[]);
            }}
          />
          <AnimatePresence>
            {markers.map((marker, index) => previewId === marker.id && (
              <MarkerPreview
                key={marker.id}
                url={node.data.url}
                marker={marker}
                index={index + 1}
                ratio={node.data.config?.ratio ?? "1:1"}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="ml-auto flex grow flex-wrap items-center justify-end gap-3">
        <OptionPopper
          label={node.data.config?.model ?? defaultModel?.name ?? "选择模型"}
          options={imageModels.map((model) => model.name)}
          value={node.data.config?.model ?? defaultModel?.name}
          onChange={(model) => {
            setNodes((nodes) =>
              nodes.map((item) =>
                item.id === node.id
                  ? { ...item, data: { ...item.data, config: { ...item.data.config, model: String(model) } } }
                  : item,
              ) as TAllNodes[],
            );
          }}
        />
        <OptionPopper
          label={node.data.config?.resolution ?? "2K"}
          options={["1K", "2K", "4K"]}
          value={node.data.config?.resolution ?? "2K"}
          onChange={(resolution) => {
            setNodes((nodes) =>
              nodes.map((item) =>
                item.id === node.id
                  ? { ...item, data: { ...item.data, config: { ...item.data.config, resolution: String(resolution) } } }
                  : item,
              ) as TAllNodes[],
            );
          }}
        />
        <span className="text-xs text-white/40">✦ {NODE_PRICE[NodeType.ImageNode]}</span>
        <button
          aria-label="生成改图"
          disabled={!markers.length || processing}
          onClick={onSubmit}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:bg-white/10 disabled:text-white/30"
        >
          {processing ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
        </div>
      </div>
    </div>
  );
};

const MarkerPreview = ({
  url,
  marker,
  index,
  ratio,
}: {
  url: string;
  marker: TImageEditMarker;
  index: number;
  ratio: string;
}) => {
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setZoomed(true), 120);
    return () => window.clearTimeout(timer);
  }, []);
  const scale = zoomed ? 2.5 : 1;
  const centerX = marker.x + (marker.width ?? 0) / 2;
  const centerY = marker.y + (marker.height ?? 0) / 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      className="pointer-events-none absolute bottom-full left-0 z-50 mb-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[#171719] shadow-2xl"
      style={{ aspectRatio: ratio.replace(":", "/") }}
    >
      <img
        src={url}
        alt="标记点预览"
        className="absolute size-full object-fill transition-all duration-700 ease-out"
        style={{
          width: `${scale * 100}%`,
          height: `${scale * 100}%`,
          left: zoomed ? `${50 - centerX * scale * 100}%` : 0,
          top: zoomed ? `${50 - centerY * scale * 100}%` : 0,
        }}
      />
      <div
        className="absolute -translate-x-1/2 -translate-y-full text-sky-500 transition-all duration-700 ease-out"
        style={{
          left: `${zoomed ? 50 : centerX * 100}%`,
          top: `${zoomed ? 50 : centerY * 100}%`,
        }}
      >
        <MapPin size={34} fill="currentColor" stroke="white" className="[&_circle]:hidden" />
        <span className="absolute left-1/2 top-1 -translate-x-1/2 text-xs font-semibold text-white">
          {index}
        </span>
      </div>
    </motion.div>
  );
};

export default MarkerEditor;
