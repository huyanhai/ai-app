import { ReactNode, useMemo } from "react";
import { NodeType } from "../types";
import { FileImage, FileText, Video } from "lucide-react";

interface INodeTypeTag {
  type: string;
}

const typeMap: Record<string, { label: string; icon: ReactNode }> = {
  [NodeType.TextNode]: {
    label: "文本节点",
    icon: <FileText size={14} />,
  },
  [NodeType.StoryNode]: {
    label: "剧本生成节点",
    icon: <FileText size={14} />,
  },
  [NodeType.ImageNode]: {
    label: "图片节点",
    icon: <FileImage size={14} />,
  },
  [NodeType.VideoNode]: {
    label: "视频节点",
    icon: <Video size={14} />,
  },
};

const NodeTypeTag = ({ type }: INodeTypeTag) => {
  const info = useMemo(() => {
    return typeMap[type];
  }, [type]);

  return (
    <div className="absolute -top-5 left-0 flex items-center gap-1">
      {info?.icon}
      <span className="text-xs font-medium">{info?.label}</span>
    </div>
  );
};

export default NodeTypeTag;
