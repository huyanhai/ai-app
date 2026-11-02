"use client";
import { memo, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, useReactFlow } from "@xyflow/react";
import { Scissors } from "lucide-react";

// 即梦风格渐变流光连线：节点 hover/选中时，与其直接相连的边
// 叠加蓝→青渐变底色 + 沿路径流动的光点
const GradientEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  selected,
}: EdgeProps) => {
  const [hovered, setHovered] = useState(false);
  const { setEdges } = useReactFlow();
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const active = !!data?.active;
  const gradientId = `edge-gradient-${id}`;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={24}
        style={{
          ...style,
          stroke: selected ? "#33a3ff" : style?.stroke,
          strokeWidth: selected ? 2.5 : style?.strokeWidth,
        }}
      />
      {selected && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={24}
          className="pointer-events-auto"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        />
      )}
      {selected && hovered && (
        <EdgeLabelRenderer>
          <button
            aria-label="断开连线"
            title="断开连线"
            className="nodrag nopan pointer-events-auto absolute flex size-7 items-center justify-center rounded-lg border border-white/10 bg-[#26262a] text-white/80 shadow-xl hover:bg-white/10 hover:text-white"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={(event) => {
              event.stopPropagation();
              setEdges((edges) => edges.filter((edge) => edge.id !== id));
            }}
          >
            <Scissors size={15} />
          </button>
        </EdgeLabelRenderer>
      )}
      {active && (
        <>
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={sourceX}
              y1={sourceY}
              x2={targetX}
              y2={targetY}
            >
              <stop offset="0%" stopColor="#33a3ff" />
              <stop offset="100%" stopColor="#3df2c6" />
            </linearGradient>
            <filter id={`${gradientId}-soft`} x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
          </defs>
          {/* 渐变底色 */}
          <path
            d={path}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={1.5}
            className="pointer-events-none"
          />
          {/* 流光：pathLength 归一化后让亮点沿路径循环流动 */}
          <path
            d={path}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={1.5}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="28 72"
            className="pointer-events-none"
            filter={`url(#${gradientId}-soft)`}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-100"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </path>
        </>
      )}
    </>
  );
};

export default memo(GradientEdge);
