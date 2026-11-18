"use client";

import { memo, useRef } from "react";
import { LayoutGrid } from "lucide-react";
import { NodeProps, NodeResizer, useNodes } from "@xyflow/react";
import { TAllNodes, TNodeGroup } from "../../types";

const GROUP_PADDING = 20;
const GROUP_MIN_WIDTH = 400;
const GROUP_MIN_HEIGHT = 240;

const GroupNode = ({ id, data, selected }: NodeProps<TNodeGroup>) => {
  const nodes = useNodes<TAllNodes>();
  const resizeBounds = useRef<{ left: number; top: number; right: number; bottom: number } | null>(null);
  const childNodes = nodes.filter((node) => node.parentId === id);
  const contentBounds = childNodes.reduce<{ left: number; top: number; right: number; bottom: number } | null>(
    (bounds, node) => {
      const left = node.position.x;
      const top = node.position.y;
      const right = left + (node.measured?.width ?? node.width ?? 0);
      const bottom = top + (node.measured?.height ?? node.height ?? 0);

      return bounds ? {
        left: Math.min(bounds.left, left),
        top: Math.min(bounds.top, top),
        right: Math.max(bounds.right, right),
        bottom: Math.max(bounds.bottom, bottom),
      } : { left, top, right, bottom };
    },
    null,
  );
  const minWidth = Math.max(
    GROUP_MIN_WIDTH,
    contentBounds ? contentBounds.right - contentBounds.left + GROUP_PADDING * 2 : 0,
  );
  const minHeight = Math.max(
    GROUP_MIN_HEIGHT,
    contentBounds ? contentBounds.bottom - contentBounds.top + GROUP_PADDING * 2 : 0,
  );

  return (
    <div className="group/group size-full">
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        onResizeStart={(_, { x, y }) => {
          resizeBounds.current = contentBounds ? {
            left: x + contentBounds.left,
            top: y + contentBounds.top,
            right: x + contentBounds.right,
            bottom: y + contentBounds.bottom,
          } : null;
        }}
        shouldResize={(_, { x, y, width, height }) => {
          const bounds = resizeBounds.current;

          return !bounds || (
            x <= bounds.left - GROUP_PADDING &&
            y <= bounds.top - GROUP_PADDING &&
            x + width >= bounds.right + GROUP_PADDING &&
            y + height >= bounds.bottom + GROUP_PADDING
          );
        }}
        handleClassName="size-2.5 opacity-0"
        lineClassName="border-transparent"
      />
      <div className={`size-full cursor-grab rounded-3xl border border-dashed transition-colors ${
        selected ? "border-[#33a3ff]/70 bg-[#33a3ff]/[0.04]" : "border-white/15 bg-white/[0.025]"
      }`} />
      <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1 flex h-7 max-w-full items-center gap-2 rounded-lg px-1.5 text-[15px] font-semibold text-white/55">
        <LayoutGrid className="size-4 shrink-0" />
        <span className="truncate">{data.title || "镜头组"}</span>
      </div>
    </div>
  );
};

export default memo(GroupNode, (prev, next) =>
  prev.data === next.data && prev.selected === next.selected && prev.dragging === next.dragging
);
