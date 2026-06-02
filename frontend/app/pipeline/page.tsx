"use client";
import { ComponentType, useCallback } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import nodeTypes from "@/components/pipeline";
import ChatInput from "@/components/pipeline/chat-input";
import { usePipelineStore } from "@/store/pipeline-store";
import { NodeType, TAllNodes } from "@/components/pipeline/types";

const page = () => {
  const setCurrentSelectNode = usePipelineStore(
    (state) => state.setCurrentSelectNode,
  );
  const currentSelectNode = usePipelineStore(
    (state) => state.currentSelectNode,
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<TAllNodes>([
    {
      id: "1",
      position: {
        x: 0,
        y: 0,
      },
      type: NodeType.TextNode,
      data: {
        text: "123",
      },
    },
    {
      id: "2",
      position: {
        x: 100,
        y: 100,
      },
      type: NodeType.ImageNode,
      data: {
        url: "https://dashscope-7c2c.oss-accelerate.aliyuncs.com/7d/d7/20260602/51613171/c6fb38f2-c917-484d-a943-4d67f591a802.png?Expires=1780970893&OSSAccessKeyId=LTAI5tPxpiCM2hjmWrFXrym1&Signature=yw%2Fl1FFs5ZIBQ6sNfsXIViE1%2FpA%3D",
      },
    },
  ]);

  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams<TAllNodes, Edge>) => {
      setCurrentSelectNode(nodes.length > 0 ? nodes[0] : null);
    },
    [setCurrentSelectNode],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={onSelectionChange}
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
  );
};

export default page;
