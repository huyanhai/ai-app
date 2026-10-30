"use client";
import {
  ReactNode,
  memo,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
} from "react";
import {
  Handle,
  Position,
  useConnection,
  useReactFlow,
} from "@xyflow/react";
import { Ban, Plus, Tags } from "lucide-react";
import {
  NODE_TYPE_LABEL,
  SOURCE_ANCHOR,
  SOURCE_HANDLE,
  TARGET_ANCHOR,
  TARGET_HANDLE,
} from "../../constants";
import { NodeType, TAllNodes } from "../../types";
import { usePipelineStore } from "@/store/pipeline-store";
import { useClickOutSide } from "@/hooks/use-click-outside";

interface INodeShellProps {
  id: string;
  type: NodeType;
  selected?: boolean;
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
}

const LABEL_COLORS = ["#22d3ee", "#6366f1", "#a855f7", "#f97316", "#eab308"];

// 所有节点共用的右上角标签色设置
const LabelColorPicker = ({ id }: { id: string }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getNode, setNodes } = useReactFlow<TAllNodes>();
  const labelColor = getNode(id)?.data.labelColor;
  useClickOutSide([containerRef], () => setOpen(false), open);

  const setLabelColor = (color?: string) => {
    setNodes(
      (nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, labelColor: color } }
            : node,
        ) as TAllNodes[],
    );
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="nodrag relative ml-auto">
      <button
        aria-label="设置标签色"
        onClick={() => setOpen((value) => !value)}
        className="flex size-5 items-center justify-center rounded text-white/30 hover:bg-white/10 hover:text-white/70 transition-colors cursor-pointer"
      >
        {labelColor ? (
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: labelColor }}
          />
        ) : (
          <Tags size={13} />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-30 mt-2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 bg-[#26262a] px-3 py-2.5 shadow-2xl">
          <button
            aria-label="清除标签色"
            onClick={() => setLabelColor()}
            className="flex size-5 items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <Ban size={17} />
          </button>
          {LABEL_COLORS.map((color) => (
            <button
              key={color}
              aria-label={`标签色 ${color}`}
              onClick={() => setLabelColor(color)}
              className={`size-4 rounded-full transition-transform hover:scale-110 cursor-pointer ${
                labelColor === color
                  ? "ring-2 ring-white ring-offset-2 ring-offset-[#26262a]"
                  : ""
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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
        <LabelColorPicker id={id} />
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

      {/* 隐形连线锚点：固定在卡片左右边缘，连线的实际起止位置 */}
      <Handle
        id={SOURCE_ANCHOR}
        type="source"
        position={Position.Left}
        isConnectable={false}
        className="opacity-0! pointer-events-none! w-px! h-6! min-w-0! min-h-0! border-0! bg-transparent!"
        style={{ left: 0, top: "50%", transform: "translateY(-50%)" }}
      />
      <Handle
        id={TARGET_ANCHOR}
        type="target"
        position={Position.Right}
        isConnectable={false}
        className="opacity-0! pointer-events-none! w-px! h-6! min-w-0! min-h-0! border-0! bg-transparent!"
        style={{ right: 0, top: "50%", transform: "translateY(-50%)" }}
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
