"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
} from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useNodesState,
  useEdgesState,
  OnSelectionChangeParams,
  Edge,
  NodeToolbar,
  Position,
  ReactFlowProvider,
  addEdge,
  Connection,
  OnConnectStartParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { History, Search, Sparkles } from "lucide-react";
import nodeTypes from "@/components/pipeline/nodes";
import edgeTypes from "@/components/pipeline/edges";
import Toolbar from "@/components/pipeline/toolbar";
import Controls from "@/components/pipeline/controls";
import AssetModal from "@/components/pipeline/asset-modal";
import AIChatPanel from "@/components/pipeline/ai-chat-panel";
import CanvasNodePanel from "@/components/pipeline/canvas-node-panel";
import { IconButton } from "@/components/ui/icon-button";
import TextToolbar from "@/components/pipeline/text-toolbar";
import MediaToolbar from "@/components/pipeline/media-toolbar";
import GeneratorCard, {
  GENERATOR_TYPES,
} from "@/components/pipeline/nodes/node/generator-card";
import Menu from "@/components/pipeline/menu";
import { TMenuRequest, usePipelineStore } from "@/store/pipeline-store";
import { NodeType, TAllNodes, TNodeBase } from "@/components/pipeline/types";
import type { ReferenceKind, SubjectReference } from "@/components/chat/types";
import {
  SOURCE_ANCHOR,
  SOURCE_HANDLE,
  TARGET_ANCHOR,
  TARGET_HANDLE,
} from "@/components/pipeline/constants";

// 连线拖拽松开后、菜单选择前的半截连线（对齐即梦：菜单弹出时连线保持显示）
const PendingEdge = ({ menuRequest }: { menuRequest: TMenuRequest }) => {
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = document.querySelector(
      `.react-flow__node[data-id="${menuRequest.nodeId}"] .react-flow__handle[data-handleid="${menuRequest.handleId}"]`,
    );
    if (el) {
      const rect = el.getBoundingClientRect();
      setFrom({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    }
  }, [menuRequest]);

  if (!from) return null;
  const to = menuRequest.position;
  const dx = Math.max(Math.abs(to.x - from.x) / 2, 40);
  const dir = to.x >= from.x ? 1 : -1;
  const d = `M ${from.x} ${from.y} C ${from.x + dx * dir} ${from.y}, ${to.x - dx * dir} ${to.y}, ${to.x} ${to.y}`;

  return (
    <svg className="pointer-events-none fixed inset-0 z-40 h-full w-full">
      <path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1}
      />
    </svg>
  );
};

const Flow = () => {
  const [aiChatOpen, setAIChatOpen] = useState(false);
  const [aiChatWidth, setAIChatWidth] = useState(400);
  const [nodePanel, setNodePanel] = useState<"search" | "history" | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<TAllNodes>([
    {
      id: "1",
      type: "textNode",
      position: { x: 0, y: 0 },
      data: {
        text: "",
      },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  // hover 中的节点 id：hover/选中节点的直接上下游连线高亮为渐变流光
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const connectingNodeId = useRef<string | null>(null);
  const connectingHandleId = useRef<string | null>(null);
  const connectingHandleType = useRef<string | null>(null);
  const connectionSuccessful = useRef(false);
  const lastConnectEnd = useRef<number>(0);

  const setCurrentSelectNode = usePipelineStore(
    (state) => state.setCurrentSelectNode,
  );
  const currentSelectNode = usePipelineStore(
    (state) => state.currentSelectNode,
  );
  const menuRequest = usePipelineStore((state) => state.menuRequest);
  const openMenu = usePipelineStore((state) => state.openMenu);
  const closeMenu = usePipelineStore((state) => state.closeMenu);
  const closeImageEditor = usePipelineStore((state) => state.setImageEditor);
  const showMiniMap = usePipelineStore((state) => state.showMiniMap);
  const showEdges = usePipelineStore((state) => state.showEdges);

  const { setCenter, screenToFlowPosition, getZoom, getNode } =
    useReactFlow<TAllNodes>();

  // 选中生成类节点后，若节点 + 底部生成卡片超出可视区域，平移画布让节点垂直居中
  const selectedNodeId = currentSelectNode?.id;
  useEffect(() => {
    if (
      !selectedNodeId ||
      !GENERATOR_TYPES.includes(currentSelectNode?.type as NodeType)
    ) {
      return;
    }
    // 等 NodeToolbar 渲染完再测量
    const frame = requestAnimationFrame(() => {
      const nodeEl = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${selectedNodeId}"]`,
      );
      const node = getNode(selectedNodeId);
      if (!nodeEl || !node) return;
      const toolbarEl = document.querySelector<HTMLElement>(
        `.react-flow__node-toolbar[data-id="${selectedNodeId}"]`,
      );
      const bottom = Math.max(
        nodeEl.getBoundingClientRect().bottom,
        toolbarEl?.getBoundingClientRect().bottom ?? 0,
      );
      if (bottom > window.innerHeight - 16) {
        const zoom = getZoom();
        // 保持水平方向不变，仅垂直居中
        const { x } = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const nodeHeight = node.measured?.height ?? 0;
        setCenter(x, node.position.y + nodeHeight / 2, {
          zoom,
          duration: 300,
        });
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  const onConnect = useCallback(
    (params: Connection) => {
      connectionSuccessful.current = true;
      // 连线锚定到卡片边缘的隐形锚点，而不是悬浮的 + 按钮
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            sourceHandle:
              params.sourceHandle === SOURCE_HANDLE
                ? SOURCE_ANCHOR
                : params.sourceHandle,
            targetHandle:
              params.targetHandle === TARGET_HANDLE
                ? TARGET_ANCHOR
                : params.targetHandle,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const onConnectStart = useCallback(
    (
      _: MouseEvent | TouchEvent,
      { nodeId, handleId, handleType }: OnConnectStartParams,
    ) => {
      connectionSuccessful.current = false;
      connectingNodeId.current = nodeId;
      connectingHandleId.current = handleId;
      connectingHandleType.current = handleType;
    },
    [],
  );

  const onConnectEnd = useCallback(
    (event: any) => {
      if (!connectingNodeId.current) return;
      if (connectionSuccessful.current) return;

      const targetIsPane = event.target.classList.contains("react-flow__pane");
      // 单击手柄（未拖动）时，松开目标仍落在手柄上，此时打开节点创建菜单
      const targetIsHandle = !!(event.target as HTMLElement).closest?.(
        ".react-flow__handle",
      );

      if (targetIsPane || targetIsHandle) {
        lastConnectEnd.current = Date.now();
        // Remove wrapper bounds in order to get the correct position
        const { clientX, clientY } =
          "changedTouches" in event ? event.changedTouches[0] : event;
        openMenu({
          position: { x: clientX, y: clientY },
          nodeId: connectingNodeId.current,
          handleId: connectingHandleId.current,
          handleType: connectingHandleType.current,
        });
      }
    },
    [openMenu],
  );

  const onSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams<TAllNodes, Edge>) => {
      setCurrentSelectNode(nodes.length > 0 ? nodes[0] : null);
    },
    [setCurrentSelectNode],
  );

  // 工具卡使用 React Flow 中的实时节点（store 里的快照不会随 setNodes 更新，会导致工具箱选择丢失）
  const liveSelectedNode =
    nodes.find((n) => n.id === currentSelectNode?.id) ?? null;

  // 右键显示菜单
  const onPaneContextMenu = useCallback(
    (event: ReactMouseEvent | MouseEvent) => {
      event.preventDefault();
      connectingNodeId.current = null;
      connectingHandleId.current = null;
      connectingHandleType.current = null;
      const clientX =
        "clientX" in event
          ? event.clientX
          : (event as any).touches?.[0]?.clientX;
      const clientY =
        "clientY" in event
          ? event.clientY
          : (event as any).touches?.[0]?.clientY;
      openMenu({ position: { x: clientX, y: clientY } });
    },
    [openMenu],
  );

  // 点击空白处
  const onPaneClick = useCallback(() => {
    if (Date.now() - lastConnectEnd.current < 100) {
      return;
    }
    closeMenu();
    closeImageEditor(null);
  }, [closeMenu, closeImageEditor]);

  // 直接拖拽节点/框选拖动时也关闭创建菜单（连带隐藏半截连线）
  const onDragStart = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  // hover/选中节点的直接上下游连线激活渐变流光高亮
  const displayEdges = useMemo(() => {
    if (!showEdges) return [];
    const activeIds = new Set(
      [hoveredNodeId, currentSelectNode?.id].filter(Boolean) as string[],
    );
    if (activeIds.size === 0) return edges;
    return edges.map((edge) =>
      activeIds.has(edge.source) || activeIds.has(edge.target)
        ? { ...edge, data: { ...edge.data, active: true } }
        : edge,
    );
  }, [edges, showEdges, hoveredNodeId, currentSelectNode]);

  const labelColors = useMemo(
    () =>
      Array.from(
        new Set(
          nodes.flatMap((node) =>
            node.data.labelColor ? [node.data.labelColor] : [],
          ),
        ),
      ),
    [nodes],
  );

  const locateNode = (nodeId: string) => {
    const target = nodes.find((node) => node.id === nodeId);
    if (!target) return;
    setNodes(
      (currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          selected: node.id === target.id,
        })) as TAllNodes[],
    );
    const panelSpace = aiChatOpen ? aiChatWidth + 26 : 0;
    const center = screenToFlowPosition({
      x: (window.innerWidth - panelSpace) / 2,
      y: window.innerHeight / 2,
    });
    setCenter(
      center.x,
      target.position.y + (target.measured?.height ?? 0) / 2,
      { zoom: getZoom(), duration: 300 },
    );
  };

  const locateLabelColor = (color: string) => {
    const target = nodes.find((node) => node.data.labelColor === color);
    if (target) locateNode(target.id);
  };

  return (
    <div className="w-full h-full relative bg-[#0a0a0a]">
      <ReactFlow
        colorMode="dark"
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        onNodeDragStart={onDragStart}
        onSelectionDragStart={onDragStart}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onMove={() => window.dispatchEvent(new Event("resize"))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        panOnScroll={true}
        fitView
        fitViewOptions={{ minZoom: 1, maxZoom: 1 }}
        defaultEdgeOptions={{
          type: "gradient",
          style: { stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={2}
          color="rgba(255,255,255,0.12)"
        />
        {showMiniMap && (
          <MiniMap
            pannable
            zoomable
            className="bg-[#1c1c1e]! rounded-xl! border! border-white/5!"
          />
        )}

        {liveSelectedNode &&
          liveSelectedNode.type === NodeType.TextNode && (
            <NodeToolbar
              nodeId={liveSelectedNode.id}
              position={Position.Top}
              isVisible={true}
              offset={12}
            >
              <TextToolbar node={liveSelectedNode} />
            </NodeToolbar>
          )}
        {liveSelectedNode &&
          [NodeType.ImageNode, NodeType.VideoNode, NodeType.AudioNode].includes(
            liveSelectedNode.type as NodeType,
          ) && (
            <NodeToolbar
              nodeId={liveSelectedNode.id}
              position={Position.Top}
              isVisible={true}
              offset={12}
            >
              <MediaToolbar node={liveSelectedNode} />
            </NodeToolbar>
          )}
        {liveSelectedNode &&
          GENERATOR_TYPES.includes(liveSelectedNode.type as NodeType) && (
            <NodeToolbar
              nodeId={liveSelectedNode.id}
              position={Position.Bottom}
              isVisible={true}
              offset={16}
              className="pointer-events-none"
            >
              <GeneratorCard node={liveSelectedNode} />
            </NodeToolbar>
          )}
      </ReactFlow>

      <Toolbar />
      <Controls />
      <AssetModal />

      <div
        className="absolute top-4 z-40 flex items-center gap-2 rounded-xl border border-white/10 bg-[#1c1c1e]/95 px-3 py-2 shadow-2xl"
        style={{ right: aiChatOpen ? aiChatWidth + 30 : 16 }}
      >
        {labelColors.map((color) => (
          <button
            key={color}
            aria-label={`定位到标签色 ${color} 的节点`}
            title="定位到标记节点"
            onClick={() => locateLabelColor(color)}
            className="size-4 cursor-pointer rounded-full transition-transform hover:scale-125"
            style={{ backgroundColor: color }}
          />
        ))}
        {labelColors.length > 0 && <span className="h-4 w-px bg-white/10" />}
        <IconButton
          label="搜索节点"
          active={nodePanel === "search"}
          onClick={() => setNodePanel(nodePanel === "search" ? null : "search")}
        >
          <Search size={16} />
        </IconButton>
        <IconButton
          label="生成历史"
          active={nodePanel === "history"}
          onClick={() => setNodePanel(nodePanel === "history" ? null : "history")}
        >
          <History size={16} />
        </IconButton>
      </div>

      {nodePanel && (
        <div
          className="absolute top-[68px] z-40"
          style={{ right: aiChatOpen ? aiChatWidth + 30 : 16 }}
        >
          <CanvasNodePanel
            type={nodePanel}
            nodes={nodes}
            onClose={() => setNodePanel(null)}
            onLocate={(nodeId) => {
              locateNode(nodeId);
              setNodePanel(null);
            }}
          />
        </div>
      )}

      {/* 与 AI 对话入口（对齐即梦右下角） */}
      <button
        onClick={() => setAIChatOpen(true)}
        className="absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-full bg-[#1c1c1e]/95 border border-white/5 px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-[#26262a] transition-colors shadow-2xl cursor-pointer nodrag nopan"
      >
        <Sparkles size={15} className="text-[#33a3ff]" />
        与 AI 对话
      </button>

      {aiChatOpen && (
        <AIChatPanel
          onClose={() => setAIChatOpen(false)}
          width={aiChatWidth}
          onWidthChange={setAIChatWidth}
          subjects={nodes.flatMap<SubjectReference>((node) => {
            const kinds: Partial<Record<NodeType, ReferenceKind>> = {
              [NodeType.SubjectNode]: "subject",
              [NodeType.ImageNode]: "image",
              [NodeType.VideoNode]: "video",
              [NodeType.AudioNode]: "audio",
              [NodeType.TextNode]: "text",
            };
            const kind = kinds[node.type as NodeType];
            if (!kind) return [];
            const data = node.data as TNodeBase & {
              name?: string;
              description?: string;
              text?: string;
              url?: string;
            };
            return [{
              id: node.id,
              kind,
              name: (kind === "subject" ? data.name : data.title) || node.id,
              description: kind === "text" ? data.text : data.description,
              url: data.url,
            }];
          })}
        />
      )}

      {menuRequest && (
        <>
          {menuRequest.nodeId && <PendingEdge menuRequest={menuRequest} />}
          <Menu
            position={menuRequest.position}
            nodeId={menuRequest.nodeId}
            handleId={menuRequest.handleId}
            handleType={menuRequest.handleType}
            setEdges={setEdges}
            setNodes={setNodes}
            setNodeEnd={closeMenu}
          />
        </>
      )}
    </div>
  );
};

const Page = () => {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
};

export default Page;
