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
  useUpdateNodeInternals,
  useNodesState,
  useEdgesState,
  useStore,
  OnSelectionChangeParams,
  Edge,
  NodeToolbar,
  Position,
  ReactFlowProvider,
  addEdge,
  Connection,
  OnConnectStartParams,
  Viewport,
} from "@xyflow/react";
import Link from "next/link";
import { nanoid } from "nanoid";
import "@xyflow/react/dist/style.css";
import { History, Home, Redo2, Search, Sparkles, Undo2 } from "lucide-react";
import { shallow } from "zustand/shallow";
import nodeTypes from "@/components/pipeline/nodes";
import edgeTypes from "@/components/pipeline/edges";
import Toolbar from "@/components/pipeline/toolbar";
import Controls from "@/components/pipeline/controls";
import AssetModal from "@/components/pipeline/asset-modal";
import AgentHost from "@/components/pipeline/agent-host";
import CanvasNodePanel from "@/components/pipeline/canvas-node-panel";
import StoryboardPrevizModal from "@/components/pipeline/storyboard-previz-modal";
import EmptyCanvasBackground from "@/components/pipeline/empty-canvas-background";
import { getNodeAlignment } from "@/components/pipeline/node-alignment";
import { IconButton } from "@/components/ui/icon-button";
import TextToolbar from "@/components/pipeline/text-toolbar";
import MediaToolbar from "@/components/pipeline/media-toolbar";
import GeneratorCard, {
  GENERATOR_TYPES,
} from "@/components/pipeline/nodes/node/generator-card";
import Menu from "@/components/pipeline/menu";
import { TMenuRequest, usePipelineStore } from "@/store/pipeline-store";
import { NodeType, TAllNodes, TNodeShotTable } from "@/components/pipeline/types";
import { DOCK_WIDTH, useAgentSettings } from "@/store/agent-settings";
import { useAgentCanvasSync } from "@/hooks/use-agent-canvas-sync";
import {
  NODE_DEFAULT_DATA,
  NODE_TYPE_LABEL,
  SOURCE_ANCHOR,
  SOURCE_HANDLE,
  TARGET_ANCHOR,
  TARGET_HANDLE,
} from "@/components/pipeline/constants";
import { canvasHistoryApi, CanvasSnapshot, type StoredCanvas } from "@/lib/canvas-history";
import type { CanvasSummary } from "@/lib/canvas-history";
import { subjectLibrary } from "@/lib/subject-library";
import CanvasContextMenu, { CanvasContextAction, CanvasContextState } from "./canvas-context-menu";
import { useCanvasId } from "@/components/pipeline/canvas-workspace-context";

const makeSnapshot = (nodes: TAllNodes[], edges: Edge[]): CanvasSnapshot => ({
  nodes: nodes.map((node) => ({
    ...node,
    selected: undefined,
    dragging: undefined,
    measured: undefined,
  })),
  edges: edges.map((edge) => ({ ...edge, selected: undefined })),
});

const withoutShotTableEdges = (snapshot: CanvasSnapshot): CanvasSnapshot => ({
  ...snapshot,
  edges: snapshot.edges.filter((edge) =>
    edge.source !== "production-shot-table" && edge.target !== "production-shot-table"
  ),
});

const areSnapshotsEqual = (previous: CanvasSnapshot, current: CanvasSnapshot) =>
  previous.nodes.length === current.nodes.length &&
  previous.edges.length === current.edges.length &&
  previous.nodes.every((node, index) => shallow(node, current.nodes[index])) &&
  previous.edges.every((edge, index) => shallow(edge, current.edges[index]));

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
      <path d={d} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
    </svg>
  );
};

const AlignmentGuides = ({ guides }: { guides: { x: number | null; y: number | null } }) => {
  const [translateX, translateY, zoom] = useStore((state) => state.transform);
  if (guides.x === null && guides.y === null) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      {guides.x !== null && (
        <div
          className="absolute inset-y-0 left-0 border-l border-dashed border-sky-400/80"
          style={{ transform: `translateX(${guides.x * zoom + translateX}px)` }}
        />
      )}
      {guides.y !== null && (
        <div
          className="absolute inset-x-0 top-0 border-t border-dashed border-sky-400/80"
          style={{ transform: `translateY(${guides.y * zoom + translateY}px)` }}
        />
      )}
    </div>
  );
};

const Flow = () => {
  const canvasId = useCanvasId();
  const [aiChatOpen, setAIChatOpen] = useState(false);
  const agentDockWidth = useAgentSettings((state) => state.dockWidth);
  const agentPanelWidth = Math.max(DOCK_WIDTH.min, Math.min(DOCK_WIDTH.max, agentDockWidth));
  useEffect(() => {
    const toggleAgent = (event: KeyboardEvent) => {
      if ((!event.metaKey && !event.ctrlKey) || event.key !== "/") return;
      event.preventDefault();
      setAIChatOpen((current) => !current);
    };
    window.addEventListener("keydown", toggleAgent);
    return () => window.removeEventListener("keydown", toggleAgent);
  }, []);
  const [nodePanel, setNodePanel] = useState<"search" | "history" | null>(null);
  const [previzOpen, setPrevizOpen] = useState(false);
  const [previzBusy, setPrevizBusy] = useState(false);
  const [previzError, setPrevizError] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<TAllNodes>([]);
  const [alignmentGuides, setAlignmentGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);
  const [contextMenu, setContextMenu] = useState<CanvasContextState | null>(null);
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [clipboardNode, setClipboardNode] = useState<TAllNodes | null>(null);
  const [canvasLoaded, setCanvasLoaded] = useState(false);
  const [hasStoredViewport, setHasStoredViewport] = useState(false);
  const currentSnapshot = useMemo(
    () => makeSnapshot(nodes, edges),
    [nodes, edges],
  );
  const latestSnapshotRef = useRef(currentSnapshot);
  const lastSavedRef = useRef({ snapshot: currentSnapshot, past, future });
  const pendingSnapshotRef = useRef<CanvasSnapshot | null>(null);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRevisionRef = useRef(0);
  const restoringRef = useRef(false);
  const agentRemoteRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestViewportRef = useRef<Viewport | null>(null);
  const nodesRef = useRef<TAllNodes[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
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
  const liveSelectedNode =
    nodes.find((node) => node.id === currentSelectNode?.id) ?? null;
  const selectedGeneratorNode = liveSelectedNode &&
    GENERATOR_TYPES.includes(liveSelectedNode.type as NodeType)
    ? liveSelectedNode
    : null;
  const [lastGeneratorNodeId, setLastGeneratorNodeId] = useState<string | null>(null);
  const selectedGeneratorNodeId = selectedGeneratorNode?.id;
  useEffect(() => {
    if (selectedGeneratorNodeId) setLastGeneratorNodeId(selectedGeneratorNodeId);
  }, [selectedGeneratorNodeId]);
  const generatorNode = selectedGeneratorNode ?? nodes.find(
    (node) => node.id === lastGeneratorNodeId &&
      GENERATOR_TYPES.includes(node.type as NodeType),
  ) ?? null;
  const menuRequest = usePipelineStore((state) => state.menuRequest);
  const openMenu = usePipelineStore((state) => state.openMenu);
  const closeMenu = usePipelineStore((state) => state.closeMenu);
  const closeImageEditor = usePipelineStore((state) => state.setImageEditor);
  const showMiniMap = usePipelineStore((state) => state.showMiniMap);
  const showEdges = usePipelineStore((state) => state.showEdges);

  const { setCenter, setViewport, screenToFlowPosition, getZoom, getNode, fitView } =
    useReactFlow<TAllNodes>();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    const selectAllNodes = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "a")
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, [contenteditable="true"], [role="textbox"]',
        )
      )
        return;
      event.preventDefault();
      window.getSelection()?.removeAllRanges();
      setNodes((currentNodes) =>
        currentNodes.map((node) => ({ ...node, selected: true })),
      );
      setEdges((currentEdges) =>
        currentEdges.map((edge) => ({ ...edge, selected: false })),
      );
    };
    window.addEventListener("keydown", selectAllNodes, true);
    return () => window.removeEventListener("keydown", selectAllNodes, true);
  }, [setEdges, setNodes]);

  const agentSync = useAgentCanvasSync({
    canvas: { id: canvasId, graph: currentSnapshot, version: canvasRevisionRef.current },
    getVersion: () => canvasRevisionRef.current,
    mergeVersion: (version) => { canvasRevisionRef.current = version; },
    hasUnsaved: () => saveTimerRef.current !== null || pendingSnapshotRef.current !== null,
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    skipNextSave: () => { restoringRef.current = true; agentRemoteRef.current = true; },
    markTasksKnown: () => {},
    resetHistory: () => { setPast((items) => items.filter((item) => item.agentRunId)); setFuture([]); },
  });

  const persistCanvas = useCallback(async (snapshot: StoredCanvas) => {
    let next = snapshot;
    let result;
    try {
      result = await canvasHistoryApi.save(canvasId, next);
    } catch (error) {
      const revision = await agentSync.autoMerge();
      if (revision === null) throw error;
      canvasRevisionRef.current = revision;
      next = { ...snapshot, nodes: nodesRef.current, edges: edgesRef.current, revision };
      result = await canvasHistoryApi.save(canvasId, next);
    }
    if (result.revision !== undefined) canvasRevisionRef.current = result.revision;
    agentSync.saved(next, result.revision ?? next.revision ?? canvasRevisionRef.current);
    return result;
  }, [agentSync, canvasId]);

  useEffect(() => {
    let active = true;
    latestViewportRef.current = null;
    setHasStoredViewport(false);
    canvasHistoryApi
      .load(canvasId)
      .then((stored) => {
        if (!active) return;
        if (stored) {
          const current = withoutShotTableEdges(stored);
          const storedPast = (stored.past ?? []).map(withoutShotTableEdges);
          const storedFuture = (stored.future ?? []).map(withoutShotTableEdges);
          canvasRevisionRef.current = stored.revision ?? 0;
          agentSync.saved(current, stored.revision ?? 0);
          restoringRef.current = true;
          latestSnapshotRef.current = makeSnapshot(current.nodes, current.edges);
          lastSavedRef.current = { snapshot: current, past: storedPast, future: storedFuture };
          setNodes(current.nodes);
          setEdges(current.edges);
          setPast(storedPast);
          setFuture(storedFuture);
          if (stored.viewport) {
            latestViewportRef.current = stored.viewport;
            setHasStoredViewport(true);
            void setViewport(stored.viewport);
          }
        }
        setCanvasLoaded(true);
      })
      .catch(() => {
        if (active) setCanvasLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [agentSync, canvasId, setEdges, setNodes, setViewport]);

  useEffect(() => {
    if (!canvasLoaded) return;
    if (restoringRef.current) {
      restoringRef.current = false;
      latestSnapshotRef.current = currentSnapshot;
      return;
    }
    if (areSnapshotsEqual(latestSnapshotRef.current, currentSnapshot)) return;
    const previous = latestSnapshotRef.current;
    latestSnapshotRef.current = currentSnapshot;
    if (!pendingSnapshotRef.current) pendingSnapshotRef.current = previous;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      const snapshot = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      if (!snapshot) return;
      setPast((items) => [...items, snapshot].slice(-50));
      setFuture([]);
    }, 500);
  }, [canvasLoaded, currentSnapshot]);

  useEffect(() => {
    if (!canvasLoaded) return;
    if (agentRemoteRef.current) {
      agentRemoteRef.current = false;
      lastSavedRef.current = { snapshot: currentSnapshot, past, future };
      return;
    }
    const lastSaved = lastSavedRef.current;
    if (
      lastSaved.past === past &&
      lastSaved.future === future &&
      areSnapshotsEqual(lastSaved.snapshot, currentSnapshot)
    ) {
      return;
    }
    lastSavedRef.current = { snapshot: currentSnapshot, past, future };
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const snapshot = { ...currentSnapshot, past, future, revision: canvasRevisionRef.current };
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => persistCanvas(snapshot))
        .then(() => undefined)
        .catch(() => undefined);
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [canvasId, canvasLoaded, currentSnapshot, future, past, persistCanvas]);

  useEffect(() => {
    if (!canvasLoaded) return;
    const syncViewport = () => {
      const viewport = latestViewportRef.current;
      if (viewport) void canvasHistoryApi.saveViewport(canvasId, viewport);
    };
    window.addEventListener("pagehide", syncViewport);
    return () => window.removeEventListener("pagehide", syncViewport);
  }, [canvasId, canvasLoaded]);

  const undo = useCallback(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    const pending = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    const available = pending ? [...past, pending] : past;
    const previous = available.at(-1);
    if (!previous) return;
    restoringRef.current = true;
    latestSnapshotRef.current = previous;
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setPast(available.slice(0, -1));
    setFuture((items) => [...items, currentSnapshot].slice(-50));
  }, [currentSnapshot, past, setEdges, setNodes]);

  const redo = useCallback(() => {
    const next = future.at(-1);
    if (!next) return;
    restoringRef.current = true;
    latestSnapshotRef.current = next;
    setNodes(next.nodes);
    setEdges(next.edges);
    setPast((items) => [...items, currentSnapshot].slice(-50));
    setFuture(future.slice(0, -1));
  }, [currentSnapshot, future, setEdges, setNodes]);

  const flushAgentCanvas = useCallback(async () => {
    if (!canvasLoaded) return canvasRevisionRef.current;
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
    const pending = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    const nextPast = pending ? [...past, pending].slice(-50) : past;
    const nextFuture = pending ? [] : future;
    const hadScheduledSave = saveTimerRef.current !== null;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const lastSaved = lastSavedRef.current;
    if (
      !pending && !hadScheduledSave &&
      lastSaved.past === nextPast && lastSaved.future === nextFuture &&
      areSnapshotsEqual(lastSaved.snapshot, currentSnapshot)
    ) {
      await saveQueueRef.current;
      return canvasRevisionRef.current;
    }
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => persistCanvas({
        ...currentSnapshot,
        past: nextPast,
        future: nextFuture,
        revision: canvasRevisionRef.current,
      }))
      .then(() => undefined);
    await saveQueueRef.current;
    lastSavedRef.current = { snapshot: currentSnapshot, past: nextPast, future: nextFuture };
    if (pending) {
      setPast(nextPast);
      setFuture(nextFuture);
    }
    return canvasRevisionRef.current;
  }, [canvasLoaded, currentSnapshot, future, past, persistCanvas]);

  const restoreHistory = useCallback(
    (index: number) => {
      const operations = [...past, currentSnapshot, ...[...future].reverse()];
      const target = operations[index];
      if (!target) return;
      restoringRef.current = true;
      latestSnapshotRef.current = target;
      setNodes(target.nodes);
      setEdges(target.edges);
      setPast(operations.slice(0, index).slice(-50));
      setFuture(operations.slice(index + 1).reverse().slice(-50));
    },
    [currentSnapshot, future, past, setEdges, setNodes],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA"].includes(target.tagName)
      )
        return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z")
        return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [redo, undo]);

  const centerGeneratorNode = useCallback((nodeId: string) => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      const nodeEl = document.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${nodeId}"]`,
      );
      const node = getNode(nodeId);
      if (!nodeEl || !node) return;
      const toolbarEl = document.querySelector<HTMLElement>(
        `.react-flow__node-toolbar[data-id="${nodeId}"]`,
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
    }));
    return () => cancelAnimationFrame(frame);
  }, [getNode, getZoom, screenToFlowPosition, setCenter]);

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
      if (nodeId) updateNodeInternals(nodeId);
      connectingNodeId.current = nodeId;
      connectingHandleId.current = handleId;
      connectingHandleType.current = handleType;
    },
    [updateNodeInternals],
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

  // 空白处右键仅显示画布操作，新建节点菜单仍由双击打开
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
      closeMenu();
      setContextMenu({ kind: "pane", x: clientX, y: clientY });
    },
    [closeMenu],
  );

  const onNodeContextMenu = useCallback((event: ReactMouseEvent, node: TAllNodes) => {
    event.preventDefault();
    closeMenu();
    setNodes((items) => items.map((item) => ({ ...item, selected: item.id === node.id })));
    setCurrentSelectNode(node);
    setContextMenu({ kind: "node", nodeId: node.id, x: event.clientX, y: event.clientY });
  }, [closeMenu, setCurrentSelectNode, setNodes]);

  // 点击空白处
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    if (Date.now() - lastConnectEnd.current < 100) {
      return;
    }
    closeMenu();
    closeImageEditor(null);
    setEdges((items) =>
      items.some((edge) => edge.selected)
        ? items.map((edge) => edge.selected ? { ...edge, selected: false } : edge)
        : items,
    );
  }, [closeMenu, closeImageEditor, setEdges]);

  const onCanvasDoubleClick = useCallback((event: ReactMouseEvent) => {
    if (!(event.target as HTMLElement).classList.contains("react-flow__pane")) return;
    setContextMenu(null);
    openMenu({ position: { x: event.clientX, y: event.clientY } });
  }, [openMenu]);

  const onEdgeClick = useCallback(
    (_: ReactMouseEvent, edge: Edge) => {
      setCurrentSelectNode(null);
      setEdges((items) =>
        items.map((item) => ({ ...item, selected: item.id === edge.id })),
      );
    },
    [setCurrentSelectNode, setEdges],
  );

  // 直接拖拽节点/框选拖动时也关闭创建菜单（连带隐藏半截连线）
  const onDragStart = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

  const onNodeDrag = useCallback((_: ReactMouseEvent, draggedNode: TAllNodes) => {
    const alignment = getNodeAlignment(draggedNode, nodes, 8 / getZoom());
    setAlignmentGuides({ x: alignment.x, y: alignment.y });
    if (alignment.deltaX === 0 && alignment.deltaY === 0) return;
    setNodes((currentNodes) => currentNodes.map((node) => node.id === draggedNode.id ? {
      ...node,
      position: {
        x: node.position.x + alignment.deltaX,
        y: node.position.y + alignment.deltaY,
      },
    } : node));
  }, [getZoom, nodes, setNodes]);

  const onNodeDragStop = useCallback((_: ReactMouseEvent, draggedNode: TAllNodes) => {
    const alignment = getNodeAlignment(draggedNode, nodes, 8 / getZoom());
    if (alignment.deltaX !== 0 || alignment.deltaY !== 0) {
      setNodes((currentNodes) => currentNodes.map((node) => node.id === draggedNode.id ? {
        ...node,
        position: {
          x: draggedNode.position.x + alignment.deltaX,
          y: draggedNode.position.y + alignment.deltaY,
        },
      } : node));
    }
    setAlignmentGuides({ x: null, y: null });
  }, [getZoom, nodes, setNodes]);

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

  const locateNode = useCallback((nodeId: string) => {
    const target = nodes.find((node) => node.id === nodeId);
    if (!target) return;
    setNodes(
      (currentNodes) =>
        currentNodes.map((node) => ({
          ...node,
          selected: node.id === target.id,
        })) as TAllNodes[],
    );
    const panelSpace = aiChatOpen ? agentPanelWidth + 26 : 0;
    const center = screenToFlowPosition({
      x: (window.innerWidth - panelSpace) / 2,
      y: window.innerHeight / 2,
    });
    setCenter(
      center.x,
      target.position.y + (target.measured?.height ?? 0) / 2,
      { zoom: getZoom(), duration: 300 },
    );
  }, [agentPanelWidth, aiChatOpen, getZoom, nodes, screenToFlowPosition, setCenter, setNodes]);

  useEffect(() => {
    const focus = (event: Event) => {
      const detail = (event as CustomEvent<{ ids?: string[]; fit?: boolean }>).detail;
      const ids = detail?.ids?.filter((id) => getNode(id)) ?? [];
      if (!ids.length) return;
      if (!detail.fit) {
        locateNode(ids[0]);
        return;
      }
      setNodes((current) => current.map((node) => ({ ...node, selected: ids.includes(node.id) })));
      void fitView({ nodes: ids.map((id) => ({ id })), padding: 0.2, duration: 300 });
    };
    window.addEventListener("agent:focus-nodes", focus);
    return () => window.removeEventListener("agent:focus-nodes", focus);
  }, [fitView, getNode, locateNode, setNodes]);

  useEffect(() => {
    const open = () => setPrevizOpen(true);
    window.addEventListener("open-storyboard-previz", open);
    return () => window.removeEventListener("open-storyboard-previz", open);
  }, []);

  const createPreviz = async () => {
    const projectId = window.localStorage.getItem(`active-production-id:${canvasId}`);
    if (!projectId) {
      setPrevizError("未找到当前画布的制作项目");
      return;
    }
    setPrevizBusy(true);
    setPrevizError("");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? ""}/productions/${projectId}/previz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || "草图节点创建失败");
      const additions = (result.nodes as TAllNodes[]).filter((node) => node.data.production?.kind === "storyboardPreviz");
      const additionMap = new Map(additions.map((node) => [node.id, node]));
      setNodes((current) => [
        ...current.map((node) => {
          const remote = additionMap.get(node.id);
          if (!remote) return node;
          const url = "url" in node.data && node.data.url ? node.data.url : "url" in remote.data ? remote.data.url : "";
          const status = "status" in node.data ? node.data.status : undefined;
          const remoteStatus = "status" in remote.data ? remote.data.status : undefined;
          return { ...remote, position: node.position, selected: node.selected, data: { ...remote.data, url, status: url ? status ?? remoteStatus : remoteStatus } };
        }),
        ...additions.filter((node) => !current.some((item) => item.id === node.id)),
      ] as TAllNodes[]);
      const additionEdges = (result.edges as Edge[]).filter((edge) => edge.target.startsWith("previz-"));
      setEdges((current) => [...current, ...additionEdges.filter((edge) => !current.some((item) => item.id === edge.id))]);
    } catch (cause) {
      setPrevizError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPrevizBusy(false);
    }
  };

  const locateLabelColor = (color: string) => {
    const target = nodes.find((node) => node.data.labelColor === color);
    if (target) locateNode(target.id);
  };

  const contextNode = contextMenu?.nodeId ? nodes.find((node) => node.id === contextMenu.nodeId) : undefined;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pipeline-node-clipboard");
      if (stored) setClipboardNode(JSON.parse(stored) as TAllNodes);
    } catch {
      localStorage.removeItem("pipeline-node-clipboard");
    }
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    void canvasHistoryApi.list().then((items) => setCanvases(items.filter((item) => item.id !== canvasId))).catch(() => setCanvases([]));
  }, [canvasId, contextMenu]);

  const copyNode = useCallback((node: TAllNodes) => {
    const copy = makeSnapshot([node], []).nodes[0];
    setClipboardNode(copy);
    localStorage.setItem("pipeline-node-clipboard", JSON.stringify(copy));
  }, []);

  const pasteNode = useCallback((position?: { x: number; y: number }) => {
    if (!clipboardNode) return;
    const copy = structuredClone(clipboardNode);
    copy.id = nanoid();
    copy.position = position ?? { x: clipboardNode.position.x + 40, y: clipboardNode.position.y + 40 };
    copy.selected = true;
    setNodes((items) => [...items.map((node) => ({ ...node, selected: false })), copy]);
    setCurrentSelectNode(copy);
  }, [clipboardNode, setCurrentSelectNode, setNodes]);

  const duplicateNode = useCallback((node: TAllNodes) => {
    copyNode(node);
    const copy = structuredClone(node);
    copy.id = nanoid();
    copy.position = { x: node.position.x + 40, y: node.position.y + 40 };
    copy.data = { ...copy.data, title: `${copy.data.title || "节点"} 副本` };
    copy.selected = true;
    setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), copy]);
    setCurrentSelectNode(copy);
  }, [copyNode, setCurrentSelectNode, setNodes]);

  const deleteNode = useCallback((node: TAllNodes) => {
    setNodes((items) => items.filter((item) => item.id !== node.id));
    setEdges((items) => items.filter((edge) => edge.source !== node.id && edge.target !== node.id));
    setCurrentSelectNode(null);
  }, [setCurrentSelectNode, setEdges, setNodes]);

  const copyImage = useCallback(async (node: TAllNodes) => {
    if (node.type !== NodeType.ImageNode || !("url" in node.data) || typeof node.data.url !== "string" || !node.data.url) return;
    const response = await fetch(node.data.url);
    const source = await response.blob();
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("图片复制失败")), "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }, []);

  const downloadNode = useCallback(async (node: TAllNodes) => {
    if (!("url" in node.data) || typeof node.data.url !== "string" || !node.data.url) return;
    const response = await fetch(node.data.url);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = node.data.title || node.id;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleContextAction = useCallback(async (action: CanvasContextAction) => {
    const node = contextNode;
    const position = contextMenu?.kind === "pane" ? screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y }) : undefined;
    setContextMenu(null);
    if (action === "undo") return undo();
    if (action === "redo") return redo();
    if (action === "paste") return pasteNode(position);
    if (!node) return;
    if (action === "copy") copyNode(node);
    if (action === "duplicate") duplicateNode(node);
    if (action === "delete") deleteNode(node);
    if (action === "copyImage") await copyImage(node).catch(() => undefined);
    if (action === "download") await downloadNode(node).catch(() => undefined);
    if (action === "cover" && node.type === NodeType.ImageNode) {
      setNodes((items) => items.map((item) => ({ ...item, data: { ...item.data, canvasCover: item.id === node.id ? true : undefined } })) as TAllNodes[]);
    }
    if (action === "saveSubject" && node.type === NodeType.ImageNode && "url" in node.data && typeof node.data.url === "string" && node.data.url) {
      subjectLibrary.add({
        id: nanoid(),
        name: node.data.title || "未命名主体",
        description: node.data.draftText,
        url: node.data.url,
      });
    }
  }, [contextMenu, contextNode, copyImage, copyNode, deleteNode, downloadNode, duplicateNode, pasteNode, redo, screenToFlowPosition, setNodes, undo]);

  const createNodeFromContext = useCallback((type: NodeType) => {
    if (!contextMenu) return;
    const position = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });
    const count = nodes.filter((node) => node.type === type).length;
    const node = {
      id: nanoid(),
      type,
      position,
      data: { ...structuredClone(NODE_DEFAULT_DATA[type]), title: `${NODE_TYPE_LABEL[type]} ${count + 1}` },
      selected: true,
    } as TAllNodes;
    setNodes((items) => [...items.map((item) => ({ ...item, selected: false })), node]);
    setCurrentSelectNode(node);
    setContextMenu(null);
  }, [contextMenu, nodes, screenToFlowPosition, setCurrentSelectNode, setNodes]);

  const saveNodeToCanvas = useCallback(async (targetCanvasId: string) => {
    if (!contextNode) return;
    const stored = await canvasHistoryApi.load(targetCanvasId);
    const copy = structuredClone(contextNode);
    copy.id = nanoid();
    copy.position = { x: contextNode.position.x + 40, y: contextNode.position.y + 40 };
    copy.selected = false;
    await canvasHistoryApi.save(targetCanvasId, {
      nodes: [...(stored?.nodes ?? []), copy],
      edges: stored?.edges ?? [],
      past: stored?.past ?? [],
      future: stored?.future ?? [],
    });
    setContextMenu(null);
  }, [contextNode]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName) || !(event.metaKey || event.ctrlKey)) return;
      const node = currentSelectNode ? getNode(currentSelectNode.id) : undefined;
      const key = event.key.toLowerCase();
      if (key === "c" && node) {
        event.preventDefault();
        if (event.shiftKey) void copyImage(node).catch(() => undefined);
        else copyNode(node);
      }
      if (key === "d" && node) {
        event.preventDefault();
        duplicateNode(node);
      }
      if (key === "v" && clipboardNode) {
        event.preventDefault();
        pasteNode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clipboardNode, copyImage, copyNode, currentSelectNode, duplicateNode, getNode, pasteNode]);

  return (
    <div className="w-full h-full relative bg-[#0a0a0a]">
      <Link href="/home" className="absolute left-4 top-4 z-40 flex p-1 h-9 items-center gap-2 rounded-xl border border-white/10 bg-[#1c1c1e]/95 px-3 text-xs text-white/65 shadow-2xl transition-colors hover:bg-white/10 hover:text-white">
        <Home size={15} />
        首页
      </Link>
      <ReactFlow
        onlyRenderVisibleElements={true}
        colorMode="dark"
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => {
          if (GENERATOR_TYPES.includes(node.type as NodeType)) centerGeneratorNode(node.id);
        }}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onDoubleClick={onCanvasDoubleClick}
        onNodeDragStart={onDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStart={onDragStart}
        onNodeMouseEnter={(_, node) => setHoveredNodeId(node.id)}
        onNodeMouseLeave={() => setHoveredNodeId(null)}
        onMove={() => window.dispatchEvent(new Event("resize"))}
        onMoveEnd={(_, viewport) => { latestViewportRef.current = viewport; }}
        minZoom={0.1}
        connectionRadius={60}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        edgesFocusable={true}
        deleteKeyCode={["Backspace", "Delete"]}
        panOnScroll={true}
        zoomOnDoubleClick={false}
        fitView={!hasStoredViewport}
        fitViewOptions={{ minZoom: 1, maxZoom: 1 }}
        defaultEdgeOptions={{
          type: "gradient",
          style: { stroke: "rgba(255,255,255,0.25)", strokeWidth: 1 },
        }}
      >
        {nodes.length > 0 && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={2}
            color="rgba(255,255,255,0.12)"
          />
        )}
        <AlignmentGuides guides={alignmentGuides} />
        {showMiniMap && (
          <MiniMap
            pannable
            zoomable
            className="bg-[#1c1c1e]! rounded-xl! border! border-white/5!"
          />
        )}

        {liveSelectedNode && liveSelectedNode.type === NodeType.TextNode && (
          <NodeToolbar
            nodeId={liveSelectedNode.id}
            position={Position.Top}
            isVisible={true}
            offset={36}
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
              offset={36}
            >
              <MediaToolbar node={liveSelectedNode} />
            </NodeToolbar>
          )}
        {generatorNode && (
          <NodeToolbar
            nodeId={generatorNode.id}
            position={Position.Bottom}
            isVisible={true}
            offset={16}
            className="pointer-events-none"
            style={{ visibility: selectedGeneratorNode ? "visible" : "hidden" }}
          >
            <GeneratorCard node={generatorNode} active={selectedGeneratorNode !== null} />
          </NodeToolbar>
        )}
      </ReactFlow>

      {nodes.length === 0 && <EmptyCanvasBackground />}

      {contextMenu && <CanvasContextMenu
        context={contextMenu}
        node={contextNode}
        canvases={canvases}
        canPaste={clipboardNode !== null}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        onAction={(action) => void handleContextAction(action)}
        onCreateNode={createNodeFromContext}
        onSaveToCanvas={(targetCanvasId) => void saveNodeToCanvas(targetCanvasId)}
        onClose={() => setContextMenu(null)}
      />}

      <Toolbar />
      <Controls />
      <AssetModal />

      <StoryboardPrevizModal
        open={previzOpen}
        shots={(nodes.find((node) => node.id === "production-shot-table") as TNodeShotTable | undefined)?.data.shots ?? []}
        nodes={nodes}
        busy={previzBusy}
        error={previzError}
        onClose={() => setPrevizOpen(false)}
        onCreate={() => void createPreviz()}
        onLocate={(nodeId) => {
          locateNode(nodeId);
          const node = getNode(nodeId);
          if (node) setCurrentSelectNode(node);
          setPrevizOpen(false);
        }}
      />

      <div
        className="absolute top-4 z-40 flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-[#1c1c1e]/95 p-1 shadow-2xl"
        style={{ right: aiChatOpen ? agentPanelWidth + 30 : 16 }}
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
          className="size-7"
          active={nodePanel === "search"}
          onClick={() => setNodePanel(nodePanel === "search" ? null : "search")}
        >
          <Search size={16} />
        </IconButton>
        <IconButton
          label="生成历史"
          className="size-7"
          active={nodePanel === "history"}
          onClick={() =>
            setNodePanel(nodePanel === "history" ? null : "history")
          }
        >
          <History size={16} />
        </IconButton>
        <span className="h-4 w-px bg-white/10" />
        <IconButton label="撤销" className="size-7" disabled={!past.length} onClick={undo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="重做" className="size-7" disabled={!future.length} onClick={redo}>
          <Redo2 size={16} />
        </IconButton>
      </div>

      {nodePanel && (
        <div
          className="absolute top-[68px] z-40"
          style={{ right: aiChatOpen ? agentPanelWidth + 30 : 16 }}
        >
          <CanvasNodePanel
            type={nodePanel}
            nodes={nodes}
            past={past}
            current={currentSnapshot}
            future={future}
            onRestoreHistory={restoreHistory}
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
        <Sparkles size={15} className="text-[#33a3ff]" />与 AI 对话
      </button>

      <AgentHost
        canvasId={canvasId}
        open={aiChatOpen}
        nodes={nodes}
        onClose={() => setAIChatOpen(false)}
        beforeSend={flushAgentCanvas}
      />

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
