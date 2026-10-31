"use client";
import { memo, useMemo, useRef, useState } from "react";
import { NodeProps, useReactFlow, useViewport } from "@xyflow/react";
import { Image, MapPin, Minus } from "lucide-react";
import { motion } from "motion/react";
import { nanoid } from "nanoid";
import NodeShell from "../shell";
import {
  TAllNodes,
  TImageEditMarker,
  TNodeImage,
  NodeType,
} from "../../../types";
import OutpaintCanvas from "./outpaint-canvas";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import { usePipelineStore } from "@/store/pipeline-store";

const IMAGE_HEIGHT = 250;
const MARKER_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z' fill='black' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") 12 22, crosshair`;

// 即梦风格图片内容卡片：空态居中图标，生成后展示图片
const ImageNode = ({ id, data, selected }: NodeProps<TNodeImage>) => {
  const { setNodes } = useReactFlow<TAllNodes>();
  const { zoom } = useViewport();
  const editorMode = usePipelineStore((state) => state.imageEditor?.nodeId === id ? state.imageEditor.mode : null);
  const editing = editorMode === "edit";
  const outpainting = editorMode === "outpaint";
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    id: string;
    corner: "nw" | "ne" | "sw" | "se";
    clientX: number;
    clientY: number;
    marker: TImageEditMarker;
  } | null>(null);
  const moveRef = useRef<{
    id: string;
    clientX: number;
    clientY: number;
    marker: TImageEditMarker;
  } | null>(null);
  const [draft, setDraft] = useState<TImageEditMarker | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [width, height] = useMemo(() => {
    if (data.config?.ratio) {
      const [w, h] = data.config.ratio.split(":").map(Number);
      let radio = w / h;
      if (w < h) {
        radio = h / w;
        return [IMAGE_HEIGHT, IMAGE_HEIGHT * radio];
      }
      return [IMAGE_HEIGHT * radio, IMAGE_HEIGHT];
    }
    return [IMAGE_HEIGHT, IMAGE_HEIGHT];
  }, [data.config]);
  const markers = data.editMarkers ?? [];

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const addMarker = (marker: Omit<TImageEditMarker, "id">) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id && node.type === NodeType.ImageNode
          ? (() => {
              const imageNode = node as TNodeImage;
              return {
                ...imageNode,
                data: {
                  ...imageNode.data,
                  editMarkers: [...(imageNode.data.editMarkers ?? []), { ...marker, id: nanoid() }],
                  editPast: [...(imageNode.data.editPast ?? []), markers],
                  editFuture: [],
                },
              };
            })()
          : node,
      ) as TAllNodes[],
    );
  };

  const removeMarker = (markerId: string) => {
    setNodes((nodes) => nodes.map((node) =>
      node.id === id && node.type === NodeType.ImageNode
        ? {
            ...node,
            data: {
              ...node.data,
              editMarkers: ((node as TNodeImage).data.editMarkers ?? []).filter((marker) => marker.id !== markerId),
              editPast: [...((node as TNodeImage).data.editPast ?? []), markers],
              editFuture: [],
            },
          }
        : node,
    ) as TAllNodes[]);
  };

  const deleteButton = (markerId: string) => (
    <button
      aria-label="删除标记"
      className="nodrag absolute right-0 top-0 z-20 flex size-5 items-center justify-center rounded-full border border-white/20 bg-white text-black cursor-pointer"
      style={{ transform: `translate(50%, -50%) scale(${1 / zoom})` }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        removeMarker(markerId);
      }}
    >
      <Minus size={12} />
    </button>
  );

  return (
    <NodeShell
      id={id}
      type={NodeType.ImageNode}
      selected={selected}
      title={data.title}
      icon={<Image size={12} />}
      chromeVisible={!editorMode}
    >
      {outpainting && data.url ? (
        <OutpaintCanvas node={{ id, data } as TNodeImage} />
      ) : (
      <motion.div
        ref={imageRef}
        className={`relative overflow-hidden rounded-2xl bg-[#1f1f22] border border-white/5 transition-all duration-500 ${
          editing ? "nodrag nopan touch-none" : ""
        }`}
        style={{
          width,
          height,
          cursor: editing ? MARKER_CURSOR : undefined,
        }}
        onPointerDown={(event) => {
          if (!editing || event.button !== 0) return;
          setSelectedMarkerId(null);
          const point = pointFromEvent(event);
          startRef.current = point;
          setDraft({ id: "draft", type: "rectangle", ...point, width: 0, height: 0 });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!editing || !startRef.current) return;
          const point = pointFromEvent(event);
          setDraft({
            id: "draft",
            type: "rectangle",
            x: Math.min(startRef.current.x, point.x),
            y: Math.min(startRef.current.y, point.y),
            width: Math.abs(point.x - startRef.current.x),
            height: Math.abs(point.y - startRef.current.y),
          });
        }}
        onPointerUp={(event) => {
          if (!editing || !startRef.current) return;
          const point = pointFromEvent(event);
          const width = Math.abs(point.x - startRef.current.x);
          const height = Math.abs(point.y - startRef.current.y);
          addMarker(
            width > 0.01 && height > 0.01
              ? {
                  type: "rectangle",
                  x: Math.min(startRef.current.x, point.x),
                  y: Math.min(startRef.current.y, point.y),
                  width,
                  height,
                }
              : { type: "pin", x: point.x, y: point.y },
          );
          startRef.current = null;
          setDraft(null);
        }}
      >
        {data.url ? (
          <>
            <img
              src={data.url}
              alt="image"
              draggable={false}
              className="w-full h-full object-cover pointer-events-none"
            />
            {editing && [...markers, ...(draft ? [draft] : [])].map((marker, index) => (
              marker.type === "rectangle" ? (
                <div
                  key={marker.id}
                  className="absolute cursor-move border-2 border-dotted border-sky-400 bg-sky-400/5"
                  style={{
                    left: `${marker.x * 100}%`,
                    top: `${marker.y * 100}%`,
                    width: `${(marker.width ?? 0) * 100}%`,
                    height: `${(marker.height ?? 0) * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setSelectedMarkerId(marker.id);
                    moveRef.current = {
                      id: marker.id,
                      clientX: event.clientX,
                      clientY: event.clientY,
                      marker: { ...marker },
                    };
                  }}
                  onPointerMove={(event) => {
                    const move = moveRef.current;
                    const rect = imageRef.current?.getBoundingClientRect();
                    if (!move || move.id !== marker.id || !rect) return;
                    event.stopPropagation();
                    const dx = (event.clientX - move.clientX) / rect.width;
                    const dy = (event.clientY - move.clientY) / rect.height;
                    const width = move.marker.width ?? 0;
                    const height = move.marker.height ?? 0;
                    const next = {
                      ...move.marker,
                      x: Math.max(0, Math.min(1 - width, move.marker.x + dx)),
                      y: Math.max(0, Math.min(1 - height, move.marker.y + dy)),
                    };
                    setNodes((nodes) => nodes.map((node) =>
                      node.id === id && node.type === NodeType.ImageNode
                        ? { ...node, data: { ...node.data, editMarkers: ((node as TNodeImage).data.editMarkers ?? []).map((item) => item.id === marker.id ? next : item) } }
                        : node,
                    ) as TAllNodes[]);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    moveRef.current = null;
                  }}
                  onMouseEnter={() => setHoveredMarkerId(marker.id)}
                  onMouseLeave={() => setHoveredMarkerId(null)}
                >
                  {marker.id !== "draft" && (hoveredMarkerId === marker.id || selectedMarkerId === marker.id) && deleteButton(marker.id)}
                  {marker.id !== "draft" && (hoveredMarkerId === marker.id || selectedMarkerId === marker.id) && (["nw", "ne", "sw", "se"] as const).map((corner) => (
                    <span
                      key={corner}
                      className={`absolute size-2 border border-sky-500 bg-white ${
                        corner === "nw" ? "-left-1 -top-1 cursor-nwse-resize" :
                        corner === "ne" ? "-right-1 -top-1 cursor-nesw-resize" :
                        corner === "sw" ? "-bottom-1 -left-1 cursor-nesw-resize" :
                        "-bottom-1 -right-1 cursor-nwse-resize"
                      }`}
                      style={{ transform: `scale(${1 / zoom})` }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        resizeRef.current = {
                          id: marker.id,
                          corner,
                          clientX: event.clientX,
                          clientY: event.clientY,
                          marker: { ...marker },
                        };
                      }}
                      onPointerMove={(event) => {
                        const resize = resizeRef.current;
                        const rect = imageRef.current?.getBoundingClientRect();
                        if (!resize || resize.id !== marker.id || !rect) return;
                        event.stopPropagation();
                        const dx = (event.clientX - resize.clientX) / rect.width;
                        const dy = (event.clientY - resize.clientY) / rect.height;
                        const initial = resize.marker;
                        const left = initial.x + (corner.includes("w") ? dx : 0);
                        const top = initial.y + (corner.includes("n") ? dy : 0);
                        const right = initial.x + (initial.width ?? 0) + (corner.includes("e") ? dx : 0);
                        const bottom = initial.y + (initial.height ?? 0) + (corner.includes("s") ? dy : 0);
                        const next = {
                          ...initial,
                          x: Math.max(0, Math.min(left, right - 0.01)),
                          y: Math.max(0, Math.min(top, bottom - 0.01)),
                          width: Math.max(0.01, Math.min(1, right) - Math.max(0, left)),
                          height: Math.max(0.01, Math.min(1, bottom) - Math.max(0, top)),
                        };
                        setNodes((nodes) => nodes.map((node) =>
                          node.id === id && node.type === NodeType.ImageNode
                            ? { ...node, data: { ...node.data, editMarkers: ((node as TNodeImage).data.editMarkers ?? []).map((item) => item.id === marker.id ? next : item) } }
                            : node,
                        ) as TAllNodes[]);
                      }}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        resizeRef.current = null;
                      }}
                    />
                  ))}
                  {marker.id !== "draft" && (
                    <div
                      className="pointer-events-none absolute bottom-0 right-0 text-sky-500"
                      style={{ transform: `translate(50%, 0%) scale(${1 / zoom})`, transformOrigin: "50% 100%" }}
                    >
                      <MapPin size={32} fill="currentColor" stroke="white" className="[&_circle]:hidden" />
                      <span className="absolute inset-0 z-10 flex items-start justify-center pt-1.5 text-xs font-bold text-white">
                        {index + 1}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  key={marker.id}
                  className="absolute origin-bottom text-sky-500"
                  style={{
                    left: `${marker.x * 100}%`,
                    top: `${marker.y * 100}%`,
                    transform: `translate(-50%, -100%) scale(${1 / zoom})`,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseEnter={() => setHoveredMarkerId(marker.id)}
                  onMouseLeave={() => setHoveredMarkerId(null)}
                >
                  {hoveredMarkerId === marker.id && deleteButton(marker.id)}
                  <MapPin size={32} fill="currentColor" stroke="white" className="[&_circle]:hidden" />
                  <span className="absolute inset-0 z-10 flex items-start justify-center pt-1.5 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                </div>
              )
            ))}
          </>
        ) : (
          data.status !== ChunkStatus.PROCESSING && (
            <div className="flex h-full w-full items-center justify-center">
              <Image size={32} className="text-white/25" strokeWidth={1.5} />
            </div>
          )
        )}
      </motion.div>
      )}
    </NodeShell>
  );
};

export default memo(ImageNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
