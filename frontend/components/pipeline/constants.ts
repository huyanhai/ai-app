import { TextScene } from "backend/src/common/utils/text-scene";
import { NodeType, TAllNodes, VideoModeType } from "./types";

export const SOURCE_HANDLE = "source";
export const TARGET_HANDLE = "target";
// 连线锚点：+ 按钮手柄仅用于交互，实际连线锚定在卡片边缘的隐形 Handle 上
export const SOURCE_ANCHOR = "source-anchor";
export const TARGET_ANCHOR = "target-anchor";

// 各节点类型的中文名称
export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  [NodeType.TextNode]: "文本",
  [NodeType.ImageNode]: "图片",
  [NodeType.VideoNode]: "视频",
  [NodeType.AudioNode]: "音频",
  [NodeType.TimelineNode]: "时间线",
  [NodeType.SubjectNode]: "主体",
  [NodeType.StageNode]: "导演台",
};

// 生成类节点提示词占位文案（对齐即梦）
export const NODE_PROMPT_PLACEHOLDER: Partial<Record<NodeType, string>> = {
  [NodeType.TextNode]:
    "通过 AI 生成文本内容，可以添加图片、视频、音频或文档作为生成参考",
  [NodeType.ImageNode]: "上传参考图、输入文字或 @ 主体，描述你想生成的图片",
  [NodeType.VideoNode]: "上传参考图、输入文字或 @ 主体，描述你想生成的视频",
  [NodeType.AudioNode]:
    "输入台词并描述声音，可上传参考音频，通过 @ 引用多个音色，使用时间戳编排人声、音效与配乐。",
};

// 文本节点生成场景（决定后端注入的系统提示词与输出格式）
export const TEXT_SCENES: { value: TextScene; label: string }[] = [
  { value: TextScene.Auto, label: "自动识别" },
  { value: TextScene.Image, label: "图片提示词" },
  { value: TextScene.Video, label: "视频提示词" },
  { value: TextScene.Script, label: "剧本" },
];

// 生成价格展示（对齐即梦）
export const NODE_PRICE: Partial<Record<NodeType, string>> = {
  [NodeType.ImageNode]: "3 / 张",
  [NodeType.VideoNode]: "56",
  [NodeType.AudioNode]: "12",
};

// 各节点类型的默认数据
export const NODE_DEFAULT_DATA: Record<NodeType, TAllNodes["data"]> = {
  [NodeType.TextNode]: { text: "" },
  [NodeType.ImageNode]: {
    url: "",
    config: {
      ratio: "1:1",
      resolution: "2K",
      count: 1,
    },
  },
  [NodeType.VideoNode]: {
    url: "",
    config: {
      videoMode: VideoModeType.TextToVideo,
      ratio: "1:1",
      duration: 4,
      resolution: "720P",
      count: 1,
    },
  },
  [NodeType.AudioNode]: {
    url: "",
    config: {},
  },
  [NodeType.TimelineNode]: {},
  [NodeType.SubjectNode]: { name: "主体 1" },
  [NodeType.StageNode]: {},
};
