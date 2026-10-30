"use client";
import { memo } from "react";
import { BaseEdge, EdgeProps, getBezierPath } from "@xyflow/react";

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
}: EdgeProps) => {
  const [path] = getBezierPath({
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
      <BaseEdge id={id} path={path} style={style} />
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
            strokeDasharray="12 88"
            className="pointer-events-none"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="-100"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>
        </>
      )}
    </>
  );
};

export default memo(GradientEdge);
