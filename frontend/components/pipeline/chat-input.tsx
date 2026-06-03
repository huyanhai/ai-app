import { CARD } from "@/constants/class-names";
import { usePipelineStore } from "@/store/pipeline-store";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { NodeType, TAllNodes, TNodeImage, TNodeText } from "./types";
import { sseFetch } from "@/lib/sse";
import { Forward } from "lucide-react";
import Editor from "./editor";
import { useNodeConnections, useReactFlow } from "@xyflow/react";

const ChatInput = <T extends TAllNodes>(props: {
  setNodes: Dispatch<SetStateAction<T[]>>;
}) => {
  const [text, setText] = useState("");
  const currentSelectNode = usePipelineStore(
    (state) => state.currentSelectNode,
  );

  const { getNode } = useReactFlow();

  const connections = useNodeConnections({
    id: currentSelectNode?.id || "",
    handleType: "source",
  });

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

    console.log(textNodes, imageNodes);

    return { textNodes, imageNodes };
  }, [connections]);

  const nodeType = useMemo(() => {
    return currentSelectNode?.type;
  }, [currentSelectNode]);

  const submit = useCallback(() => {
    const url =
      nodeType === NodeType.TextNode ? "/pipeline/text" : "/pipeline/image";
    const abortController = new AbortController();
    sseFetch({
      url,
      body: JSON.stringify({ message: text }),
      abortController,
      cb: (data) => {
        if (data.type === "msg_chunk") {
          if (nodeType === NodeType.TextNode) {
            updateNodeData(currentSelectNode?.id || "", { text: data.content });
          } else {
            updateNodeData(currentSelectNode?.id || "", { url: data.content });
          }
        }
      },
    });

    setText("");
  }, [currentSelectNode, text]);

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

  return (
    <div
      className={`${CARD} nodrag nopan nowheel flex-col w-[400px] h-[120px]`}
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Editor
          value={text}
          onChange={setText}
          onSubmit={submit}
          images={allNodes.imageNodes}
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={submit}
          className={`flex size-8 items-center justify-center rounded-full bg-white/50 hover:bg-white transition text-black ${text ? "cursor-pointer bg-white!" : "cursor-not-allowed"}`}
        >
          <Forward size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
