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
import { NodeType, TAllNodes, TNodeImage, TNodeText } from "../types";
import { sseFetch } from "@/lib/sse";
import { Forward } from "lucide-react";
import Editor, { IEditorRef } from "../editor";
import { useNodeConnections, useReactFlow } from "@xyflow/react";
import Config from "./config";

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
  const allNodes = useMemo(() => {
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
    return allNodes.textNodes[0]?.data.text ?? "";
  }, [nodeId, allNodes.textNodes]);

  const submit = useCallback(async () => {
    const messages = await editorRef.current?.getEditor();
    editorRef.current?.clear();

    const url =
      nodeType === NodeType.TextNode ? "/pipeline/text" : "/pipeline/image";
    const abortController = new AbortController();
    sseFetch({
      url,
      body: JSON.stringify({
        message: messages,
        config: nodeData?.config,
      }),
      abortController,
      cb: (data) => {
        if (data.type === "msg_chunk") {
          if (nodeType === NodeType.TextNode) {
            updateNodeData(nodeId || "", { text: data.content });
          } else {
            updateNodeData(nodeId || "", { url: data.content });
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

  return (
    <div className={`${CARD} nodrag nopan nowheel flex-col w-100 h-30`}>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Editor
          ref={editorRef}
          key={nodeId}
          onSubmit={submit}
          images={allNodes.imageNodes}
          initialState={initialState}
          onStateChange={updatePromptWithJson}
          onEmptyStateChange={setIsEmpty}
        />
      </div>
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {nodeType === NodeType.ImageNode && (
            <Config
              key={nodeId}
              config={nodeData?.config}
              changeConfig={(config) => {
                pipelineStore.updateSelectNodeData(config);
                updateNodeData(nodeId || "", {
                  ...nodeData,
                  config,
                } as TAllNodes["data"]);
              }}
            />
          )}
        </div>
        <button
          onClick={submit}
          className={`flex size-8 items-center justify-center rounded-full bg-white/50 hover:bg-white transition text-black ${!isEmpty ? "cursor-pointer bg-white!" : "cursor-not-allowed"}`}
        >
          <Forward size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
