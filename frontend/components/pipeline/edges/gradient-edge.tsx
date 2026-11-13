"use client";
import { memo, MouseEvent as ReactMouseEvent, useRef, useState } from "react";
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
  const pathRef = useRef<SVGPathElement>(null);
  const [scissorsPoint, setScissorsPoint] = useState<{ x: number; y: number } | null>(null);
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
  const flowGradientId = `${gradientId}-flow`;
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const flowLength = 0.28;

  const followPointer = (event: ReactMouseEvent<SVGElement | HTMLButtonElement>) => {
    const pathElement = pathRef.current;
    const svg = pathElement?.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!pathElement || !svg || !matrix) return;

    const pointer = svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const { x, y } = pointer.matrixTransform(matrix.inverse());
    const totalLength = pathElement.getTotalLength();
    const samples = 32;
    let nearestLength = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index <= samples; index += 1) {
      const length = (index / samples) * totalLength;
      const point = pathElement.getPointAtLength(length);
      const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestLength = length;
      }
    }

    let step = totalLength / samples;
    for (let iteration = 0; iteration < 6; iteration += 1) {
      for (const length of [nearestLength - step, nearestLength + step]) {
        const clampedLength = Math.max(0, Math.min(totalLength, length));
        const point = pathElement.getPointAtLength(clampedLength);
        const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestLength = clampedLength;
        }
      }
      step /= 2;
    }

    const point = pathElement.getPointAtLength(nearestLength);
    setScissorsPoint({ x: point.x, y: point.y });
  };

  const currentPoint = scissorsPoint ?? { x: labelX, y: labelY };

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
      {data?.kind === "continuity" && (
        <EdgeLabelRenderer>
          <span
            className="nodrag nopan pointer-events-none absolute rounded-full border border-cyan-300/15 bg-[#1b1b1e] px-2 py-0.5 text-[10px] whitespace-nowrap text-cyan-100/60"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 12}px)` }}
          >
            尾帧续接
          </span>
        </EdgeLabelRenderer>
      )}
      {selected && (
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={24}
          className="pointer-events-auto"
          onMouseMove={followPointer}
          onMouseLeave={() => setScissorsPoint(null)}
        />
      )}
      {selected && (
        <EdgeLabelRenderer>
          <button
            aria-label="断开连线"
            title="断开连线"
            className="nodrag nopan pointer-events-auto absolute flex size-7 items-center justify-center rounded-lg border border-white/10 bg-[#26262a] text-white/80 shadow-xl hover:bg-white/10 hover:text-white"
            style={{
              transform: `translate(-50%, -50%) translate(${currentPoint.x}px, ${currentPoint.y}px)`,
              transition: scissorsPoint ? "transform 60ms ease-out" : "transform 160ms ease-out",
            }}
            onMouseMove={followPointer}
            onMouseLeave={() => setScissorsPoint(null)}
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
            <linearGradient
              id={flowGradientId}
              gradientUnits="userSpaceOnUse"
              x1={sourceX}
              y1={sourceY}
              x2={sourceX + deltaX * flowLength}
              y2={sourceY + deltaY * flowLength}
            >
              <stop offset="0%" stopColor="white" stopOpacity={0} />
              <stop offset="50%" stopColor="white" stopOpacity={0.85} />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                from={`${-deltaX * flowLength} ${-deltaY * flowLength}`}
                to={`${deltaX} ${deltaY}`}
                dur="2.4s"
                repeatCount="indefinite"
              />
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
          {/* 流光：透明渐变光带沿路径移动，两端自然淡出 */}
          <path
            d={path}
            fill="none"
            stroke={`url(#${flowGradientId})`}
            strokeWidth={1.5}
            strokeLinecap="round"
            className="pointer-events-none"
          />
        </>
      )}
    </>
  );
};

export default memo(GradientEdge);
