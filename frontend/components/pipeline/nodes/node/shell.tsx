"use client";
import { ReactNode, memo, useRef, MouseEvent as ReactMouseEvent } from "react";
import { Handle, Position, useConnection } from "@xyflow/react";
import { Plus } from "lucide-react";
import { NODE_TYPE_LABEL, SOURCE_HANDLE, TARGET_HANDLE } from "../../constants";
import { NodeType } from "../../types";
import { usePipelineStore } from "@/store/pipeline-store";

interface INodeShellProps {
  id: string;
  type: NodeType;
  selected?: boolean;
  title?: string;
  icon?: ReactNode;
  titleExtra?: ReactNode;
  children: ReactNode;
}

// 即梦风格 hover 连线手柄：平时隐藏，hover 节点时显示为 + 圆钮
// 本质是 React Flow Handle：从它拖出即可连线，单击（未拖动）由页面层打开创建菜单
const HANDLE_CLASS =
  "static! transform-none! w-6! h-6! rounded-full! bg-[#26262a]! border! border-white/10! text-white/70 flex! items-center! justify-center! cursor-crosshair hover:border-white/50! hover:text-white!";

// 磁吸连线手柄：外层为隐形感应区（仅 hover 节点时接收指针），
// 鼠标进入后 + 钮中心平滑对齐指针位置，离开后过渡回默认位置
const MagneticHandle = ({
  id,
  type,
  side,
  selected,
}: {
  id: string;
  type: "source" | "target";
  side: "left" | "right";
  selected?: boolean;
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);

  const follow = (e: ReactMouseEvent<HTMLDivElement>) => {
    const area = areaRef.current;
    const btn = btnRef.current;
    if (!area || !btn) return;
    const rect = area.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    btn.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const reset = () => {
    if (btnRef.current) btnRef.current.style.transform = "";
  };

  return (
    <div
      ref={areaRef}
      onMouseMove={follow}
      onMouseLeave={reset}
      className={`absolute top-1/2 z-10 flex h-16 w-9 -translate-y-1/2 items-center justify-center transition-opacity ${
        selected
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none group-hover/node:opacity-100 group-hover/node:pointer-events-auto"
      } ${side === "left" ? "-left-10" : "-right-10"}`}
    >
      <div
        ref={btnRef}
        className="transition-transform duration-200 ease-out cursor-crosshair"
      >
        <Handle
          type={type}
          position={side === "left" ? Position.Left : Position.Right}
          id={id}
          className={HANDLE_CLASS}
        >
          <Plus size={14} className="pointer-events-none" />
        </Handle>
      </div>
    </div>
  );
};

// 即梦风格节点外壳：卡片上方标题栏 + hover 时左右两侧的 + 连线手柄
const NodeShell = ({
  id,
  type,
  selected,
  title,
  icon,
  titleExtra,
  children,
}: INodeShellProps) => {
  // 创建菜单打开期间，作为连线起点的节点保持 + 手柄可见
  const menuOpen = usePipelineStore((s) => s.menuRequest?.nodeId === id);
  // 连线拖拽过程中（未松开鼠标），起点节点的 + 手柄保持可见
  const connecting = useConnection((c) => c.inProgress && c.fromNode?.id === id);
  const handlesVisible = selected || menuOpen || connecting;

  return (
    <div className="group/node relative">
      {/* 标题栏 */}
      <div className="absolute -top-6 left-0 right-0 flex items-center gap-1 text-white/60 select-none">
        {icon}
        <span className="text-xs font-medium whitespace-nowrap">
          {title || NODE_TYPE_LABEL[type]}
        </span>
        {titleExtra && <span className="ml-auto">{titleExtra}</span>}
      </div>

      <MagneticHandle
        id={SOURCE_HANDLE}
        type={SOURCE_HANDLE}
        side="left"
        selected={handlesVisible}
      />
      <MagneticHandle
        id={TARGET_HANDLE}
        type={TARGET_HANDLE}
        side="right"
        selected={handlesVisible}
      />

      <div
        className={`rounded-2xl transition-shadow cursor-grab active:cursor-grabbing ${
          selected ? "ring-2 ring-white/40" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default memo(NodeShell);
