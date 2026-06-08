import { CARD } from "@/constants/class-names";
import { usePipelineStore } from "@/store/pipeline-store";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  NodeType,
  TAllNodes,
  TNodeBase,
  TNodeImage,
  TNodeText,
  VideoModeType,
} from "../types";
import { sseFetch } from "@/lib/sse";
import { Forward } from "lucide-react";
import Editor, { IEditorRef } from "../editor";
import { useNodeConnections, useReactFlow } from "@xyflow/react";
import RatioConfig from "./config/ratio-config";
import VideoConfig from "./config/video-config";
import DurationConfig from "./config/duration-config";
import { IMediaData } from "backend/src/common/utils/ai-stream-utils";
import Frame from "./frame";

const cacheInputNodePrompts = new Map<string, string>();

const ChatInput = <T extends TAllNodes>(props: {
  setNodes: Dispatch<SetStateAction<T[]>>;
}) => {
  const [isEmpty, setIsEmpty] = useState(true);
  const editorRef = useRef<IEditorRef>(null);

  const { getNode } = useReactFlow();

  const pipelineStore = usePipelineStore();

  const [nodeType, nodeId, nodeData] = useMemo(() => {
    return [
      pipelineStore.currentSelectNode?.type,
      pipelineStore.currentSelectNode?.id,
      pipelineStore.currentSelectNode?.data,
    ];
  }, [pipelineStore.currentSelectNode]);

  // 当前节点的连线
  const connections = useNodeConnections({
    id: nodeId || "",
    handleType: "source",
  });

  // 跟当前节点相连的节点
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
  }, [connections]);

  // 计算当前节点的初始内容：优先用缓存的输入，其次用节点已有数据
  const initialState = useMemo(() => {
    if (!nodeId) return "";
    const cached = cacheInputNodePrompts.get(nodeId);
    if (cached) return cached;
    return "";
  }, [nodeId]);

  const disabled = useMemo(() => {
    return !textNodes.length && !imageNodes.length && !!isEmpty;
  }, [textNodes, imageNodes, isEmpty]);

  const submit = useCallback(async () => {
    const messages = await editorRef.current?.getEditor();
    editorRef.current?.clear();

    if (!nodeType) return;

    const url = {
      [NodeType.TextNode]: "/pipeline/text",
      [NodeType.ImageNode]: "/pipeline/image",
      [NodeType.VideoNode]: "/pipeline/video",
    }[nodeType!];

    const abortController = new AbortController();
    sseFetch({
      url: url as string,
      body: JSON.stringify({
        message: messages,
        config: nodeData?.config,
        textList: textNodes.map((node) => JSON.parse(node.data.text)),
      }),
      abortController,
      cb: (data) => {
        if (data.type === "msg_chunk") {
          if (nodeType === NodeType.TextNode) {
            updateNodeData(nodeId || "", { text: data.content as string });
          } else {
            const { url, status } = data.content as IMediaData;
            updateNodeData(nodeId || "", { url, status });
          }
        }
      },
    });

    // 提交后清空当前节点的缓存，下次切回时输入框为空
    if (nodeId) {
      cacheInputNodePrompts.delete(nodeId!);
    }
  }, [pipelineStore.currentSelectNode]);

  // 更新当前选中的节点上的数据
  function updateNodeData<T extends TAllNodes["data"]>(id: string, data: T) {
    props.setNodes((nodes) => {
      return nodes.map((node) => {
        if (node.id === id) {
          node = {
            ...node,
            data: {
              ...node.data,
              ...data,
            },
          };
        }
        return node;
      });
    });
  }

  // 缓存当前节点的输入内容
  function updatePromptWithJson(json: string) {
    if (nodeId) {
      cacheInputNodePrompts.set(nodeId, json);
    }
  }

  function changeConfig(config: TNodeBase["config"]) {
    const finallyConfig = { ...nodeData?.config, ...config };
    pipelineStore.updateSelectNodeData(finallyConfig);
    updateNodeData(nodeId || "", {
      ...nodeData,
      config: finallyConfig,
    } as TAllNodes["data"]);
  }

  return (
    <div className={`${CARD} nodrag nopan nowheel flex-col w-100 h-30`}>
      {nodeData?.config?.videoMode ===
        VideoModeType.FirstAndLastFrameToVideo && (
        <Frame config={nodeData?.config} changeConfig={changeConfig} />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Editor
          ref={editorRef}
          key={nodeId}
          noImageMention={
            nodeType === NodeType.VideoNode &&
            [
              VideoModeType.FirstAndLastFrameToVideo,
              VideoModeType.TextToVideo,
            ].includes(nodeData?.config?.videoMode!)
          }
          onSubmit={submit}
          images={imageNodes}
          initialState={initialState}
          onStateChange={updatePromptWithJson}
          onEmptyStateChange={setIsEmpty}
        />
      </div>
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {nodeType === NodeType.VideoNode && (
            <>
              <VideoConfig
                config={nodeData?.config}
                changeConfig={changeConfig}
              />
              <DurationConfig
                config={nodeData?.config}
                changeConfig={changeConfig}
              />
            </>
          )}
          {[NodeType.ImageNode, NodeType.VideoNode].includes(
            nodeType as NodeType,
          ) && (
            <RatioConfig
              key={nodeId}
              config={nodeData?.config}
              changeConfig={changeConfig}
            />
          )}
        </div>
        <button
          onClick={submit}
          disabled={disabled}
          className={`flex size-8 items-center justify-center rounded-full bg-white/50 hover:bg-white transition text-black ${!disabled ? "cursor-pointer bg-white!" : "cursor-not-allowed"}`}
        >
          <Forward size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
