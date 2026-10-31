"use client";

import { useRef } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { NodeType, TAllNodes, TNodeImage } from "../../../types";

type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type DragState = {
  direction: Direction | "move";
  clientX: number;
  clientY: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export const originalSize = (ratio = "1:1") => {
  const [width, height] = ratio.split(":").map(Number);
  return width >= height
    ? { width: 250 * (width / height), height: 250 }
    : { width: 250, height: 250 * (height / width) };
};

export const outpaintSize = (originalRatio: string, selectedRatio: string) => {
  const original = originalSize(originalRatio);
  if (selectedRatio === "original") return original;
  const [width, height] = selectedRatio.split(":").map(Number);
  const ratio = width / height;
  return ratio > original.width / original.height
    ? { width: original.height * ratio, height: original.height }
    : { width: original.width, height: original.width / ratio };
};

const handles: { direction: Direction; className: string; cursor: string }[] = [
  { direction: "nw", className: "left-0 top-0", cursor: "nwse-resize" },
  { direction: "n", className: "left-1/2 top-0 -translate-x-1/2", cursor: "ns-resize" },
  { direction: "ne", className: "right-0 top-0", cursor: "nesw-resize" },
  { direction: "e", className: "right-0 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { direction: "se", className: "bottom-0 right-0", cursor: "nwse-resize" },
  { direction: "s", className: "bottom-0 left-1/2 -translate-x-1/2", cursor: "ns-resize" },
  { direction: "sw", className: "bottom-0 left-0", cursor: "nesw-resize" },
  { direction: "w", className: "left-0 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

const CornerHandle = ({ direction }: { direction: Direction }) => {
  const rotation = direction === "ne" ? 90 : direction === "se" ? 180 : direction === "sw" ? 270 : 0;
  return (
    <svg width="8.5" height="8.5" viewBox="0 0 8.5 8.5" fill="none" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M7.5 0C8.05228 0 8.5 0.447715 8.5 1V3H3V8.5H1C0.447716 8.5 0 8.05229 0 7.5V1.6C0 0.716344 0.716344 0 1.6 0H7.5Z" stroke="black" strokeOpacity=".3" strokeWidth="2" />
      <path d="M7.5 0C8.05228 0 8.5 0.447715 8.5 1V3H3V8.5H1C0.447716 8.5 0 8.05229 0 7.5V1.6C0 0.716344 0.716344 0 1.6 0H7.5Z" fill="white" fillRule="evenodd" />
    </svg>
  );
};

const EdgeHandle = ({ vertical }: { vertical: boolean }) => (
  <svg width="16" height="3" viewBox="0 0 16 3" fill="none" aria-hidden="true" style={{ transform: vertical ? "rotate(90deg)" : undefined }}>
    <path d="M1.56509 0.473402C1.7474 0.17908 2.06899 0 2.4152 0H13.5848C13.931 0 14.2526 0.17908 14.4349 0.473402L16 3H0L1.56509 0.473402Z" stroke="black" strokeOpacity=".3" strokeWidth="2" />
    <path d="M1.56509 0.473402C1.7474 0.17908 2.06899 0 2.4152 0H13.5848C13.931 0 14.2526 0.17908 14.4349 0.473402L16 3H0L1.56509 0.473402Z" fill="white" fillRule="evenodd" />
  </svg>
);

const OutpaintCanvas = ({ node }: { node: TNodeImage }) => {
  const { setNodes } = useReactFlow<TAllNodes>();
  const viewport = useViewport();
  const dragRef = useRef<DragState | null>(null);
  const original = originalSize(node.data.config?.ratio);
  const width = node.data.outpaintWidth ?? original.width * 2;
  const height = node.data.outpaintHeight ?? original.height * 2;
  const x = node.data.outpaintX ?? (original.width - width) / 2;
  const y = node.data.outpaintY ?? (original.height - height) / 2;
  const zoom = node.data.outpaintZoom ?? 1;

  const startDrag = (event: React.PointerEvent<HTMLElement>, direction: Direction | "move") => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { direction, clientX: event.clientX, clientY: event.clientY, x, y, width, height };
  };

  const updateLayer = (event: React.PointerEvent<HTMLElement>) => {
    const start = dragRef.current;
    if (!start) return;
    event.stopPropagation();
    const dx = (event.clientX - start.clientX) / (viewport.zoom * zoom);
    const dy = (event.clientY - start.clientY) / (viewport.zoom * zoom);
    let next = { outpaintX: start.x, outpaintY: start.y, outpaintWidth: start.width, outpaintHeight: start.height };
    if (start.direction === "move") {
      next.outpaintX = Math.min(0, Math.max(original.width - start.width, start.x + dx));
      next.outpaintY = Math.min(0, Math.max(original.height - start.height, start.y + dy));
    } else {
      if (start.direction.includes("e")) next.outpaintWidth = Math.max(original.width - start.x, start.width + dx);
      if (start.direction.includes("w")) {
        next.outpaintX = Math.min(0, start.x + dx);
        next.outpaintWidth = start.x + start.width - next.outpaintWidth;
      }
      if (start.direction.includes("s")) next.outpaintHeight = Math.max(original.height - start.y, start.height + dy);
      if (start.direction.includes("n")) {
        next.outpaintY = Math.min(0, start.y + dy);
        next.outpaintHeight = start.y + start.height - next.outpaintHeight;
      }
    }
    setNodes((nodes) => nodes.map((item) =>
      item.id === node.id && item.type === NodeType.ImageNode
        ? { ...item, data: { ...item.data, ...next, outpaintRatio: `${next.outpaintWidth}:${next.outpaintHeight}` } }
        : item,
    ) as TAllNodes[]);
  };

  const layerEvents = (direction: Direction | "move") => ({
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => startDrag(event, direction),
    onPointerMove: updateLayer,
    onPointerUp: () => { dragRef.current = null; },
  });

  return (
    <div className="nodrag nopan relative" style={{ width: original.width * zoom, height: original.height * zoom }}>
      <img src={node.data.url} alt="原始图片" draggable={false} className="pointer-events-none absolute inset-0 z-10 size-full object-cover" />
      <div
        {...layerEvents("move")}
        data-outpaint-layer={node.id}
        className="nodrag nopan absolute cursor-move bg-[#171719]/90"
        style={{
          left: x * zoom,
          top: y * zoom,
          width: width * zoom,
          height: height * zoom,
          backgroundImage: "linear-gradient(45deg,#242428 25%,transparent 25%),linear-gradient(-45deg,#242428 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#242428 75%),linear-gradient(-45deg,transparent 75%,#242428 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        }}
      >
      </div>
      <div
        className="pointer-events-none absolute z-20 border border-white/80"
        style={{ left: x * zoom, top: y * zoom, width: width * zoom, height: height * zoom }}
      />
      {handles.map(({ direction, cursor }) => {
        const left = direction.includes("w") ? x : direction.includes("e") ? x + width : x + width / 2;
        const top = direction.includes("n") ? y : direction.includes("s") ? y + height : y + height / 2;
        return (
          <button
            key={direction}
            {...layerEvents(direction)}
            aria-label={`调整扩图区域 ${direction}`}
            className="nodrag nopan absolute z-30 flex items-center justify-center text-white"
            style={{
              cursor,
              left: left * zoom,
              top: top * zoom,
              transform: `translate(-50%, -50%) scale(${1 / (viewport.zoom * zoom)})`,
            }}
          >
            {direction.length === 2 ? <CornerHandle direction={direction} /> : <EdgeHandle vertical={direction === "e" || direction === "w"} />}
          </button>
        );
      })}
    </div>
  );
};

export default OutpaintCanvas;
