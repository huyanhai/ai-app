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
import { NodeType, TAllNodes, TNodeImage, TNodeStage, TNodeText } from "../types";
import { IEditorRef } from "../editor";
import { usePipelineStore } from "@/store/pipeline-store";
import { getImagePreset } from "../nodes/node/image/presets";
import { SOURCE_HANDLE, TARGET_HANDLE } from "../constants";
import { canvasHistoryApi } from "@/lib/canvas-history";
import { readStageReference } from "@/components/stage/reference";

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
  const imageEditorMode = usePipelineStore((state) =>
    state.imageEditor?.nodeId === nodeId && nodeType === NodeType.ImageNode
      ? state.imageEditor.mode
      : null,
  );
  const isImageEditing = imageEditorMode === "edit";
  const isOutpainting = imageEditorMode === "outpaint";
  const isUpscaling = imageEditorMode === "upscale";
  const { getNode, setNodes } = useReactFlow<TAllNodes>();

  // 左侧上游节点是当前节点的参考素材，右侧子节点不参与当前节点生成。
  const incomingConnections = useNodeConnections({
    id: nodeId,
    handleType: "target",
  });
  const outgoingConnections = useNodeConnections({
    id: nodeId,
    handleType: "source",
  });

  const { textNodes, imageNodes, videoNodes, stageNodes } = useMemo(() => {
    const textNodes: TNodeText[] = [];
    const imageNodes: TNodeImage[] = [];
    const videoNodes: TNodeImage[] = [];
    const stageNodes: TNodeStage[] = [];
    const referenceIds = incomingConnections.map((connection) => connection.source);
    outgoingConnections.forEach((connection) => {
      if (connection.sourceHandle === TARGET_HANDLE && connection.targetHandle === SOURCE_HANDLE) {
        referenceIds.push(connection.target);
      }
    });
    new Set(referenceIds).forEach((referenceId) => {
      const node = getNode(referenceId);
      if (node?.type === NodeType.TextNode) {
        textNodes.push(node as TNodeText);
      }
      if (node?.type === NodeType.ImageNode) {
        imageNodes.push(node as TNodeImage);
      }
      if (node?.type === NodeType.StageNode) {
        stageNodes.push(node as TNodeStage);
      }
      if (node?.type === NodeType.VideoNode) {
        videoNodes.push(node as TNodeImage);
      }
    });
    return { textNodes, imageNodes, videoNodes, stageNodes };
  }, [incomingConnections, outgoingConnections, getNode]);

  const disabled = useMemo(() => {
    const hasStageReference = nodeType === NodeType.VideoNode && stageNodes.length > 0;
    const hasVideoReference = nodeType === NodeType.VideoNode && videoNodes.length > 0;
    return !textNodes.length && !imageNodes.length && !hasStageReference && !hasVideoReference && isEmpty;
  }, [nodeType, textNodes, imageNodes, videoNodes, stageNodes, isEmpty]);

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
    updateNodeData(nodeId, { draftText: "" });
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

    let stageReferences: ReturnType<typeof readStageReference>[] = [];
    try {
      if (nodeType === NodeType.VideoNode) {
        stageReferences = stageNodes.map((node, index) => readStageReference(node.id, index, node.data.title));
      }
    } catch (error) {
      updateNodeData(nodeId, {
        status: ChunkStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const editorMessages = await editorRef.current?.getEditor();
    if (stageReferences.length) {
      if (stageReferences.length > 1 || textNodes.length || imageNodes.length || videoNodes.length || editorMessages?.length) {
        updateNodeData(nodeId, {
          status: ChunkStatus.FAILED,
          error: "几何预演仅支持单个导演台连接，请使用独立视频节点",
        });
        return;
      }
      const reference = stageReferences[0];
      editorRef.current?.clear();
      updateNodeData(nodeId, {
        draftText: "",
        url: reference.video,
        status: ChunkStatus.SUCCESS,
        error: undefined,
        config: { ...nodeData?.config, ratio: "16:9", duration: reference.duration ?? nodeData?.config?.duration },
      });
      void canvasHistoryApi.recordGeneration({
        nodeId,
        nodeType,
        title: nodeData?.title || nodeId,
        model: "3D 几何预演",
        url: reference.video,
      }).catch(() => undefined);
      return;
    }
    if (nodeType === NodeType.VideoNode && videoNodes.some((node) => !node.data.url || node.data.status !== ChunkStatus.SUCCESS)) {
      updateNodeData(nodeId, {
        status: ChunkStatus.FAILED,
        error: "上游视频尚未生成完成，请先生成几何预演",
      });
      return;
    }
    editorRef.current?.clear();
    updateNodeData(nodeId, { draftText: "" });
    const imagePreset = nodeData && "preset" in nodeData
      ? getImagePreset(nodeData.preset)
      : undefined;
    const editMarkers =
      nodeData && "editMarkers" in nodeData ? nodeData.editMarkers : undefined;
    const editPrompt =
      nodeData && "editPrompt" in nodeData ? nodeData.editPrompt : undefined;
    const outpaintPrompt =
      nodeData && "outpaintPrompt" in nodeData ? nodeData.outpaintPrompt : undefined;
    const upscaleDetail =
      nodeData && "upscaleDetail" in nodeData ? nodeData.upscaleDetail ?? 50 : 50;
    const upscaleResolution =
      nodeData && "upscaleResolution" in nodeData ? nodeData.upscaleResolution ?? "4K" : "4K";
    const referenceMessages = imageNodes
      .filter((image) => image.data.url)
      .map((image) => ({ type: "image_url" as const, image_url: image.data.url }));
    let videoReferenceMessages: { type: "video_url"; video_url: string }[] = [];
    if (nodeType === NodeType.VideoNode) {
      try {
        videoReferenceMessages = await Promise.all(videoNodes.map(async (video) => {
          const url = await canvasHistoryApi.ensureMp4(video.data.url);
          if (url !== video.data.url) updateNodeData(video.id, { url });
          return { type: "video_url" as const, video_url: url };
        }));
      } catch (error) {
        updateNodeData(nodeId, {
          status: ChunkStatus.FAILED,
          error: `预演视频转码失败，请检查网络后重试：${error instanceof Error ? error.message : String(error)}`,
        });
        return;
      }
    }
    const messages =
      isImageEditing && nodeData && "url" in nodeData && nodeData.url
        ? [
            { type: "image_url" as const, image_url: nodeData.url },
            {
              type: "text" as const,
              text: `对图片进行智能优化，保持未标记区域和主体特征不变。${editPrompt ? `修改要求：${editPrompt}。` : ""}标记区域：${(editMarkers ?? [])
                .map((marker, index) =>
                  marker.type === "pin"
                    ? `${index + 1}: 点(${(marker.x * 100).toFixed(0)}%, ${(marker.y * 100).toFixed(0)}%)`
                    : `${index + 1}: 矩形(${(marker.x * 100).toFixed(0)}%, ${(marker.y * 100).toFixed(0)}%, 宽${((marker.width ?? 0) * 100).toFixed(0)}%, 高${((marker.height ?? 0) * 100).toFixed(0)}%)`,
                )
                .join("；")}`,
            },
          ]
        : isOutpainting && nodeData && "url" in nodeData && nodeData.url
          ? [
              { type: "image_url" as const, image_url: nodeData.url },
              {
                type: "text" as const,
                text: `以原图中心内容为基础向外扩展画面，保持原始图片内容、主体位置、色彩和风格不变，仅自然补全新增区域。${outpaintPrompt ? `扩展要求：${outpaintPrompt}` : ""}`,
              },
            ]
          : isUpscaling && nodeData && "url" in nodeData && nodeData.url
            ? [
                { type: "image_url" as const, image_url: nodeData.url },
                {
                  type: "text" as const,
                  text: `对原图进行智能超清，保持画面内容、构图、主体特征、色彩和风格不变，提升清晰度并自然补充细节。目标分辨率：${upscaleResolution}；细节生成程度：${upscaleDetail}。`,
                },
              ]
            : imagePreset
              ? [
                  ...referenceMessages,
                  {
                    type: "text" as const,
                    text: `${imagePreset.prompt}\n画面比例：${nodeData?.config?.ratio ?? imagePreset.ratio}，完整展示所有主体和画面内容，不要裁切。`,
                  },
                  ...(editorMessages ?? []),
                ]
              : [...referenceMessages, ...(editorMessages ?? [])];

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
    const toolbox = nodeData?.config?.toolbox;
    const toolboxPrompt = [
      toolbox?.camera?.camera && `相机：${toolbox.camera.camera}`,
      toolbox?.camera?.lens && `镜头：${toolbox.camera.lens}`,
      toolbox?.camera?.focal && `焦距：${toolbox.camera.focal}`,
      toolbox?.camera?.aperture && `光圈：${toolbox.camera.aperture}`,
      toolbox?.palette && `配色方案：${toolbox.palette}`,
      toolbox?.style && `画面风格：${toolbox.style}`,
      toolbox?.movement && `运镜方式：${toolbox.movement}`,
    ].filter(Boolean).join("\n");
    const videoReferencePrompt = videoReferenceMessages.length
      ? "视频参考用于保持角色动作、移动路径、相机运镜和时序；图片参考仅用于人物外观、服装、材质和环境。不要改变预演视频的动作与镜头设计。"
      : "";
    const requestMessages = [
      ...videoReferenceMessages,
      ...(messages ?? []),
      ...(videoReferencePrompt ? [{ type: "text" as const, text: videoReferencePrompt }] : []),
      ...(toolboxPrompt ? [{ type: "text" as const, text: toolboxPrompt }] : []),
    ];
    const requestDuration = videoNodes.length && !nodeData?.config?.durationTouched
      ? videoNodes[0].data.config?.duration ?? nodeData?.config?.duration
      : nodeData?.config?.duration;
    const requestRatio = videoNodes.length && !nodeData?.config?.ratioTouched
      ? videoNodes[0].data.config?.ratio ?? "16:9"
      : nodeData?.config?.ratio;
    updateNodeData(nodeId, {
      status: ChunkStatus.PROCESSING,
      error: undefined,
      ...(videoNodes.length ? { config: { ...nodeData?.config, duration: requestDuration, ratio: requestRatio } } : {}),
    });
    let generationRecorded = false;
    sseFetch({
      url,
      body: JSON.stringify({
        message: requestMessages,
        config: {
          ...nodeData?.config,
          duration: requestDuration,
          ratio: isOutpainting && nodeData && "outpaintRatio" in nodeData && nodeData.outpaintRatio !== "original"
            ? nodeData.outpaintRatio
            : requestRatio,
          resolution: isUpscaling ? upscaleResolution : nodeData?.config?.resolution,
          edit: isImageEditing || isOutpainting || isUpscaling || Boolean(imagePreset) || referenceMessages.length > 0,
          outpaint: isOutpainting,
          upscale: isUpscaling,
          preset: imagePreset?.id,
          upscaleDetail: isUpscaling ? upscaleDetail : undefined,
        },
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
          if (status === ChunkStatus.SUCCESS && url && !generationRecorded && nodeType) {
            generationRecorded = true;
            void canvasHistoryApi.recordGeneration({
              nodeId,
              nodeType,
              title: nodeData?.title || nodeId,
              model: nodeData?.config?.model,
              url,
            }).catch(() => undefined);
          }
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
  }, [nodeType, nodeData, textNodes, imageNodes, videoNodes, stageNodes, nodeId, updateNodeData, chat, isImageEditing, isOutpainting, isUpscaling]);

  return { editorRef, submit, disabled, setIsEmpty, imageNodes, videoNodes };
};
