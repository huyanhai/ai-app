import { CARD } from "@/constants/class-names";
import { usePipelineStore } from "@/store/pipeline-store";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { NodeType, TAllNodes } from "./types";
import { sseFetch } from "@/lib/sse";
import { Forward } from "lucide-react";

const ChatInput = <T extends TAllNodes>(props: {
  setNodes: Dispatch<SetStateAction<T[]>>;
}) => {
  const [text, setText] = useState("");
  const currentSelectNode = usePipelineStore(
    (state) => state.currentSelectNode,
  );

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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

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
    <div className={`${CARD} flex-col w-[400px] h-[120px]`}>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        onKeyDown={onKeyDown}
        placeholder="请输入需求"
        className="flex-1 bg-transparent border-0 outline-none w-full h-full resize-none text-sm"
      ></textarea>
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
