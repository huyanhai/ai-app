"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNodeConnections, useReactFlow } from "@xyflow/react";
import { sseFetch } from "@/lib/sse";
import {
  IMediaData,
  IStoryData,
} from "backend/src/common/utils/ai-stream-utils";
import { NodeType, TAllNodes, TNodeImage, TNodeText } from "../types";
import { IEditorRef } from "../editor";
import { useNode } from "./use-node";

const SUBMIT_URL: Partial<Record<NodeType, string>> = {
  [NodeType.TextNode]: "/pipeline/text",
  [NodeType.ImageNode]: "/pipeline/image",
  [NodeType.VideoNode]: "/pipeline/video",
};

// 节点卡片内嵌的生成逻辑（从 ChatInput 抽取，对齐即梦「节点内直接生成」的交互）
export const useGenerate = (
  nodeId: string,
  nodeType: NodeType | undefined,
  nodeData: TAllNodes["data"] | undefined,
) => {
  const editorRef = useRef<IEditorRef>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const { getNode, setNodes } = useReactFlow<TAllNodes>();
  const { createNode } = useNode();

  // 当前节点 source 句柄引出的连线，目标节点作为参考素材
  const connections = useNodeConnections({
    id: nodeId,
    handleType: "source",
  });

  const { textNodes, imageNodes } = useMemo(() => {
    const textNodes: TNodeText[] = [];
    const imageNodes: TNodeImage[] = [];

    connections.forEach((con) => {
      const node = getNode(con.target);
      if (node?.type === NodeType.TextNode) {
        textNodes.push(node as TNodeText);
      }
      if (node?.type === NodeType.ImageNode) {
        imageNodes.push(node as TNodeImage);
      }
    });
    return { textNodes, imageNodes };
  }, [connections, getNode]);

  const disabled = useMemo(() => {
    return !textNodes.length && !imageNodes.length && isEmpty;
  }, [textNodes, imageNodes, isEmpty]);

  const updateNodeData = useCallback(
    <T extends TAllNodes["data"]>(id: string, data: T) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...data } }
            : node,
        ) as TAllNodes[],
      );
    },
    [setNodes],
  );

  const submit = useCallback(async () => {
    if (!nodeType) return;
    const url = SUBMIT_URL[nodeType];
    if (!url) return;

    const messages = await editorRef.current?.getEditor();
    editorRef.current?.clear();

    const abortController = new AbortController();
    sseFetch({
      url,
      body: JSON.stringify({
        message: messages,
        config: nodeData?.config,
        textList: textNodes.map((node) => JSON.parse(node.data.text)),
      }),
      abortController,
      cb: (data) => {
        if (data.type === "msg_chunk") {
          if (nodeType === NodeType.TextNode) {
            if ((data.content as IStoryData)?.screen) {
              createNode(
                NodeType.TextNode,
                { text: (data.content as IStoryData)?.screen },
                { x: 0, y: 0 },
              );
            } else {
              updateNodeData(nodeId, { text: data.content as string });
            }
          } else {
            const { url, status } = data.content as IMediaData;
            updateNodeData(nodeId, { url, status });
          }
        }
      },
    });
  }, [nodeType, nodeData, textNodes, nodeId, createNode, updateNodeData]);

  return { editorRef, submit, disabled, setIsEmpty, imageNodes };
};
