"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNodeConnections, useReactFlow } from "@xyflow/react";
import { sseFetch } from "@/lib/sse";
import {
  ChunkStatus,
  IMediaData,
} from "backend/src/common/utils/ai-stream-utils";
import {
  getAudioModel,
  getImageModel,
  getTextModel,
  getVideoModel,
  isModelReady,
} from "@/store/model-store";
import { NodeType, TAllNodes, TNodeImage, TNodeText } from "../types";
import { IEditorRef } from "../editor";

// 文本节点走会话接口（见 chat），不在此表中
const SUBMIT_URL: Partial<Record<NodeType, string>> = {
  [NodeType.ImageNode]: "/pipeline/image",
  [NodeType.VideoNode]: "/pipeline/video",
  [NodeType.AudioNode]: "/pipeline/audio",
};

// 节点卡片内嵌的生成逻辑（从 ChatInput 抽取，对齐即梦「节点内直接生成」的交互）
export const useGenerate = (
  nodeId: string,
  nodeType: NodeType | undefined,
  nodeData: TAllNodes["data"] | undefined,
) => {
  const editorRef = useRef<IEditorRef>(null);
  // 同一节点再次发送时中止上一次未结束的会话
  const abortRef = useRef<AbortController | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const { getNode, setNodes } = useReactFlow<TAllNodes>();

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

  // 文本节点：调用会话接口，用模型配置页选中的文本模型流式写入节点
  const chat = useCallback(async () => {
    const parts = (await editorRef.current?.getEditor()) ?? [];
    // 会话接口只接收文本，@ 引用的图片暂不下发
    const prompt = parts
      .map((part) =>
        typeof part === "string" ? part : part.type === "text" ? part.text : "",
      )
      .filter(Boolean)
      .join("\n");
    // 相连的文本节点作为参考资料
    const references = textNodes
      .map((node) => node.data.text?.trim())
      .filter(Boolean);
    const content = [
      references.length
        ? `参考资料：\n${references.map((text, i) => `[${i + 1}] ${text}`).join("\n\n")}`
        : "",
      prompt,
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!content) return;

    const model = getTextModel(nodeData?.config?.model);
    if (!model || !isModelReady(model)) {
      updateNodeData(nodeId, {
        status: ChunkStatus.FAILED,
        error: "未配置可用的文本模型，请先在 配置 → 模型配置 中完善",
      });
      return;
    }

    editorRef.current?.clear();
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    let text = "";
    updateNodeData(nodeId, {
      text,
      status: ChunkStatus.PROCESSING,
      error: undefined,
    });
    try {
      await sseFetch({
        url: "/pipeline/chat",
        body: JSON.stringify({
          modelId: model.id,
          scene: nodeData?.config?.scene,
          messages: [{ role: "user", content }],
        }),
        abortController,
        cb: (event) => {
          if (event.type === "msg_chunk") {
            text += event.content as string;
            updateNodeData(nodeId, { text });
          }
          if (event.type === "msg_end") {
            updateNodeData(nodeId, { status: ChunkStatus.SUCCESS });
          }
          if (event.type === "msg_error") {
            updateNodeData(nodeId, {
              status: ChunkStatus.FAILED,
              error: event.error,
            });
          }
        },
      });
    } catch (err) {
      if (abortController.signal.aborted) return;
      updateNodeData(nodeId, {
        status: ChunkStatus.FAILED,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [nodeData, textNodes, nodeId, updateNodeData]);

  const submit = useCallback(async () => {
    if (!nodeType) return;
    if (nodeType === NodeType.TextNode) return chat();
    const url = SUBMIT_URL[nodeType];
    if (!url) return;

    const messages = await editorRef.current?.getEditor();
    editorRef.current?.clear();

    const selectedModel =
      nodeType === NodeType.ImageNode
        ? getImageModel(nodeData?.config?.model)
        : nodeType === NodeType.VideoNode
          ? getVideoModel(nodeData?.config?.model)
          : nodeType === NodeType.AudioNode
            ? getAudioModel(nodeData?.config?.model)
            : undefined;
    if (
      (nodeType === NodeType.ImageNode ||
        nodeType === NodeType.VideoNode ||
        nodeType === NodeType.AudioNode) &&
      (!selectedModel || !isModelReady(selectedModel))
    ) {
      updateNodeData(nodeId, {
        status: ChunkStatus.FAILED,
        error: "未配置可用的模型，请先在 配置 → 模型配置 中完善",
      });
      return;
    }

    const abortController = new AbortController();
    sseFetch({
      url,
      body: JSON.stringify({
        message: messages,
        config: nodeData?.config,
        modelId: selectedModel?.id,
        textList: textNodes.map((node) => {
          try {
            return JSON.parse(node.data.text);
          } catch {
            return {
              action: "文本",
              action_input: node.data.text,
              supplementary: {
                style: "",
                ratio: nodeData?.config?.ratio ?? "1:1",
              },
            };
          }
        }),
      }),
      abortController,
      cb: (data) => {
        if (data.type === "msg_chunk") {
          const { url, status } = data.content as IMediaData;
          updateNodeData(nodeId, { url, status });
        }
        if (data.type === "msg_error") {
          updateNodeData(nodeId, {
            status: ChunkStatus.FAILED,
            error: data.error,
          });
        }
      },
    }).catch((error) => {
      updateNodeData(nodeId, {
        status: ChunkStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, [nodeType, nodeData, textNodes, nodeId, updateNodeData, chat]);

  return { editorRef, submit, disabled, setIsEmpty, imageNodes };
};
