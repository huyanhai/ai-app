"use client";
import {
  useCallback,
  useRef,
  useState,
  MouseEvent as ReactMouseEvent,
} from "react";
import {
  Background,
  MiniMap,
  ReactFlow,
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
  XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import nodeTypes from "@/components/pipeline/nodes";
import ChatInput from "@/components/pipeline/chat-input";
import { usePipelineStore } from "@/store/pipeline-store";
import { TAllNodes } from "@/components/pipeline/types";
import Menu from "@/components/pipeline/menu";

const Flow = () => {
  const [endPos, setEndPos] = useState<XYPosition | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<TAllNodes>([
    {
      id: "2",
      type: "textNode",
      data: {
        text: "12",
      },
      position: { x: 100, y: 100 },
    },
    {
      id: "1",
      type: "imageNode",
      data: {
        url: "https://gips2.baidu.com/it/u=195724436,3554684702&fm=3028&app=3028&f=JPEG&fmt=auto",
      },
      position: { x: 0, y: 0 },
    },
    {
      id: "3",
      type: "imageNode",
      data: {
        url: "https://gips0.baidu.com/it/u=3602773692,1512483864&fm=3028&app=3028&f=JPEG&fmt=auto?w=960&h=1280",
      },
      position: { x: 20, y: 0 },
    },
    {
      id: "4",
      type: "imageNode",
      data: {
        url: "",
      },
      position: { x: 200, y: 200 },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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

  const onConnect = useCallback(
    (params: Connection) => {
      connectionSuccessful.current = true;
      setEdges((eds) => addEdge(params, eds));
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

  const onConnectEnd = useCallback((event: any) => {
    if (!connectingNodeId.current) return;
    if (connectionSuccessful.current) return;

    const targetIsPane = event.target.classList.contains("react-flow__pane");

    if (targetIsPane) {
      lastConnectEnd.current = Date.now();
      // Remove wrapper bounds in order to get the correct position
      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0] : event;
      setEndPos({ x: clientX, y: clientY });
    }
  }, []);

  const onSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams<TAllNodes, Edge>) => {
      setCurrentSelectNode(nodes.length > 0 ? nodes[0] : null);
    },
    [setCurrentSelectNode],
  );

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
      setEndPos({ x: clientX, y: clientY });
    },
    [],
  );

  // 点击空白处
  const onPaneClick = useCallback(() => {
    if (Date.now() - lastConnectEnd.current < 100) {
      return;
    }
    setEndPos(null);
  }, []);

  function setNodeEnd() {
    setEndPos(null);
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        colorMode="dark"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        panOnScroll={true}
        fitView
        fitViewOptions={{ minZoom: 1, maxZoom: 1 }}
      >
        <Background />
        <MiniMap />

        {currentSelectNode && (
          <NodeToolbar
            nodeId={currentSelectNode.id}
            position={Position.Bottom}
            isVisible={true}
          >
            <ChatInput setNodes={setNodes} />
          </NodeToolbar>
        )}
      </ReactFlow>

      {endPos && (
        <Menu
          position={endPos}
          nodeId={connectingNodeId.current}
          handleId={connectingHandleId.current}
          handleType={connectingHandleType.current}
          setEdges={setEdges}
          setNodes={setNodes}
          setNodeEnd={setNodeEnd}
        />
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
