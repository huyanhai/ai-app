"use client";

import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Download, Expand, WandSparkles } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { NodeType, TAllNodes } from "./types";
import { usePipelineStore } from "@/store/pipeline-store";

const MediaToolbar = ({ node }: { node: TAllNodes }) => {
  const { zoomTo } = useReactFlow();
  const [downloading, setDownloading] = useState(false);
  const imageEditor = usePipelineStore((state) => state.imageEditor);
  const setImageEditor = usePipelineStore((state) => state.setImageEditor);
  const url = "url" in node.data ? node.data.url : "";
  const extension =
    node.type === NodeType.ImageNode
      ? "png"
      : node.type === NodeType.VideoNode
        ? "mp4"
        : "mp3";

  const download = async () => {
    if (!url || downloading) return;
    setDownloading(true);
    const anchor = document.createElement("a");
    anchor.download = `${node.data.title || "生成结果"}.${extension}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("下载失败");
      const objectUrl = URL.createObjectURL(await response.blob());
      anchor.href = objectUrl;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.click();
    } finally {
      setDownloading(false);
    }
  };

  if (imageEditor?.nodeId === node.id) return null;

  return (
    <div className="nodrag flex items-center rounded-xl border border-white/5 bg-[#26262a] p-1 shadow-2xl">
      {node.type === NodeType.ImageNode && (
        <IconButton
          label="智能改图"
          active={imageEditor?.nodeId === node.id && imageEditor.mode === "edit"}
          disabled={!url}
          onClick={() => {
            const editing = imageEditor?.nodeId !== node.id || imageEditor.mode !== "edit";
            setImageEditor(editing ? { nodeId: node.id, mode: "edit" } : null);
            if (editing) void zoomTo(1.5, { duration: 300 });
          }}
          className="h-7 w-auto gap-1.5 whitespace-nowrap px-2 text-xs text-white/70"
        >
          <WandSparkles size={13} />
          智能改图
        </IconButton>
      )}
      {node.type === NodeType.ImageNode && (
        <IconButton
          label="扩图"
          active={imageEditor?.nodeId === node.id && imageEditor.mode === "outpaint"}
          disabled={!url}
          onClick={() => {
            const editing = imageEditor?.nodeId !== node.id || imageEditor.mode !== "outpaint";
            setImageEditor(editing ? { nodeId: node.id, mode: "outpaint" } : null);
          }}
          className="h-7 w-auto gap-1.5 whitespace-nowrap px-2 text-xs text-white/70"
        >
          <Expand size={13} />
          扩图
        </IconButton>
      )}
      <IconButton
        label="下载"
        disabled={!url || downloading}
        onClick={() => void download()}
        className="size-7 text-white/70"
      >
        <Download size={13} />
      </IconButton>
    </div>
  );
};

export default MediaToolbar;
